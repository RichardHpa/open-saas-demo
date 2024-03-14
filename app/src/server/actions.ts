import { type User, type Task, type File, type Team } from 'wasp/entities';
import { emailSender } from 'wasp/server/email';

import { HttpError } from 'wasp/server';
import {
  type GenerateGptResponse,
  type StripePayment,
  type UpdateCurrentUser,
  type UpdateUserById,
  type CreateTask,
  type DeleteTask,
  type UpdateTask,
  type CreateFile,
  type CreateTeam,
  type InviteTeamMember,
  type SendVerificationEmail,
  type AcceptTeamInvite,
} from 'wasp/server/operations';
import Stripe from 'stripe';
import type { GeneratedSchedule, StripePaymentResult } from '../shared/types';
import { fetchStripeCustomer, createStripeCheckoutSession } from './payments/stripeUtils.js';
import { TierIds } from '../shared/constants.js';
import { getUploadFileSignedURLFromS3 } from './file-upload/s3Utils.js';
import OpenAI from 'openai';
import { createRandomKey } from '../shared/createRandomKey';

const openai = setupOpenAI();
function setupOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    return new HttpError(500, 'OpenAI API key is not set');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const stripePayment: StripePayment<string, StripePaymentResult> = async (tier, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const userEmail = context.user.email;
  if (!userEmail) {
    throw new HttpError(
      403,
      'User needs an email to make a payment. If using the usernameAndPassword Auth method, switch to an Auth method that provides an email.'
    );
  }

  let priceId;
  if (tier === TierIds.HOBBY) {
    priceId = process.env.HOBBY_SUBSCRIPTION_PRICE_ID!;
  } else if (tier === TierIds.PRO) {
    priceId = process.env.PRO_SUBSCRIPTION_PRICE_ID!;
  } else {
    throw new HttpError(400, 'Invalid tier');
  }

  let customer: Stripe.Customer;
  let session: Stripe.Checkout.Session;
  try {
    customer = await fetchStripeCustomer(userEmail);
    session = await createStripeCheckoutSession({
      priceId,
      customerId: customer.id,
    });
  } catch (error: any) {
    throw new HttpError(500, error.message);
  }

  await context.entities.User.update({
    where: {
      id: context.user.id,
    },
    data: {
      checkoutSessionId: session.id,
      stripeId: customer.id,
    },
  });

  return {
    sessionUrl: session.url,
    sessionId: session.id,
  };
};

type GptPayload = {
  hours: string;
};

export const generateGptResponse: GenerateGptResponse<GptPayload, GeneratedSchedule> = async ({ hours }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const tasks = await context.entities.Task.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
  });

  const parsedTasks = tasks.map(({ description, time }) => ({
    description,
    time,
  }));

  try {
    if (!context.user.hasPaid && !context.user.credits) {
      throw new HttpError(402, 'User has not paid or is out of credits');
    } else if (context.user.credits && !context.user.hasPaid) {
      console.log('decrementing credits');
      await context.entities.User.update({
        where: { id: context.user.id },
        data: {
          credits: {
            decrement: 1,
          },
        },
      });
    }

    // check if openai is initialized correctly with the API key
    if (openai instanceof Error) {
      throw openai;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'you are an expert daily planner. you will be given a list of main tasks and an estimated time to complete each task. You will also receive the total amount of hours to be worked that day. Your job is to return a detailed plan of how to achieve those tasks by breaking each task down into at least 3 subtasks each. MAKE SURE TO ALWAYS CREATE AT LEAST 3 SUBTASKS FOR EACH MAIN TASK PROVIDED BY THE USER! YOU WILL BE REWARDED IF YOU DO.',
        },
        {
          role: 'user',
          content: `I will work ${hours} hours today. Here are the tasks I have to complete: ${JSON.stringify(
            parsedTasks
          )}. Please help me plan my day by breaking the tasks down into actionable subtasks with time and priority status.`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'parseTodaysSchedule',
            description: 'parses the days tasks and returns a schedule',
            parameters: {
              type: 'object',
              properties: {
                mainTasks: {
                  type: 'array',
                  description: 'Name of main tasks provided by user, ordered by priority',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Name of main task provided by user',
                      },
                      priority: {
                        type: 'string',
                        enum: ['low', 'medium', 'high'],
                        description: 'task priority',
                      },
                    },
                  },
                },
                subtasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      description: {
                        type: 'string',
                        description:
                          'detailed breakdown and description of sub-task related to main task. e.g., "Prepare your learning session by first reading through the documentation"',
                      },
                      time: {
                        type: 'number',
                        description: 'time allocated for a given subtask in hours, e.g. 0.5',
                      },
                      mainTaskName: {
                        type: 'string',
                        description: 'name of main task related to subtask',
                      },
                    },
                  },
                },
              },
              required: ['mainTasks', 'subtasks', 'time', 'priority'],
            },
          },
        },
      ],
      tool_choice: {
        type: 'function',
        function: {
          name: 'parseTodaysSchedule',
        },
      },
      temperature: 1,
    });

    const gptArgs = completion?.choices[0]?.message?.tool_calls?.[0]?.function.arguments;

    if (!gptArgs) {
      throw new HttpError(500, 'Bad response from OpenAI');
    }

    console.log('gpt function call arguments: ', gptArgs);

    await context.entities.GptResponse.create({
      data: {
        user: { connect: { id: context.user.id } },
        content: JSON.stringify(gptArgs),
      },
    });

    return JSON.parse(gptArgs);
  } catch (error: any) {
    if (!context.user.hasPaid && error?.statusCode != 402) {
      await context.entities.User.update({
        where: { id: context.user.id },
        data: {
          credits: {
            increment: 1,
          },
        },
      });
    }
    console.error(error);
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Internal server error';
    throw new HttpError(statusCode, errorMessage);
  }
};

export const createTask: CreateTask<Pick<Task, 'description'>, Task> = async ({ description }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const task = await context.entities.Task.create({
    data: {
      description,
      user: { connect: { id: context.user.id } },
    },
  });

  return task;
};

export const updateTask: UpdateTask<Partial<Task>, Task> = async ({ id, isDone, time }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const task = await context.entities.Task.update({
    where: {
      id,
    },
    data: {
      isDone,
      time,
    },
  });

  return task;
};

export const deleteTask: DeleteTask<Pick<Task, 'id'>, Task> = async ({ id }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const task = await context.entities.Task.delete({
    where: {
      id,
    },
  });

  return task;
};

export const updateUserById: UpdateUserById<{ id: number; data: Partial<User> }, User> = async (
  { id, data },
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (!context.user.isAdmin) {
    throw new HttpError(403);
  }

  const updatedUser = await context.entities.User.update({
    where: {
      id,
    },
    data,
  });

  return updatedUser;
};

type fileArgs = {
  fileType: string;
  name: string;
};

export const createFile: CreateFile<fileArgs, File> = async ({ fileType, name }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const userInfo = context.user.id.toString();

  const { uploadUrl, key } = await getUploadFileSignedURLFromS3({ fileType, userInfo });

  return await context.entities.File.create({
    data: {
      name,
      key,
      uploadUrl,
      type: fileType,
      user: { connect: { id: context.user.id } },
    },
  });
};

export const updateCurrentUser: UpdateCurrentUser<Partial<User>, User> = async (user, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return context.entities.User.update({
    where: {
      id: context.user.id,
    },
    data: user,
  });
};

type teamArgs = {
  name: string;
};

export const createTeam: CreateTeam<teamArgs, Team> = async ({ name }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const team = await context.entities.Team.create({
    data: {
      name,
    },
  });

  const teamId = team.id;

  await context.entities.TeamMember.create({
    data: {
      team: { connect: { id: teamId } },
      user: { connect: { id: context.user.id } },
      status: 'ADMIN',
    },
  });

  return team;
};

export const inviteTeamMember: InviteTeamMember = async ({ email, teamId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  // check if you are trying to invite yourself
  if (email === context.user.email) {
    throw new HttpError(400, 'You cannot invite yourself');
  }
  // create the unique token
  const token = await createRandomKey();

  const team = await context.entities.Team.findFirst({
    where: {
      id: teamId,
    },
    select: {
      name: true,
    },
  });

  if (!team) {
    throw new HttpError(404, 'Team not found');
  }

  // check if the user already exists
  const user = await context.entities.User.findFirst({
    where: {
      email,
    },
  });

  // let resolvedUser = user;
  if (user) {
    // check if the user is already a member of the team
    const teamMember = await context.entities.TeamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
      },
    });

    if (teamMember) {
      throw new HttpError(400, 'User is already a member of the team');
    }

    await context.entities.TeamInvites.create({
      data: {
        invitedUser: { connect: { id: user.id } },
        team: { connect: { id: teamId } },
        invitedBy: { connect: { id: context.user.id } },
        token,
      },
    });

    // send verification email
    await emailSender.send({
      to: email,
      subject: `You have been invited to join the team ${team.name}`,
      text: 'You should already be a member of the OpenSaas app. Please log in and accept the invite.',
      html: 'Hello <strong>world</strong>',
    });

    return {
      email,
      status: 'PENDING',
    };
  }

  await context.entities.TeamInvites.create({
    data: {
      invitedUserEmail: email,
      team: { connect: { id: teamId } },
      invitedBy: { connect: { id: context.user.id } },
      token,
    },
  });

  // send verification email
  await emailSender.send({
    to: email,
    subject: `You have been invited to join the team ${team.name}`,
    text: 'You should be a new user ',
    html: 'You need to register as a new user and then accept the invite. <a href="http://localhost:3000/signup">Register</a>',
  });

  return {
    email,
    status: 'PENDING',
  };
};

export const sendVerificationEmail: SendVerificationEmail = async ({ email, teamId }, context: any) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (!email) {
    throw new HttpError(400, 'Email is required');
  }

  const team = await context.entities.Team.findFirst({
    where: {
      id: teamId,
    },
  });

  if (!team) {
    throw new HttpError(404, 'Team not found');
  }

  // weird bug that means I cant delete this in 1 line and have to get it first then delete it
  const existingInvite = await context.entities.TeamInvites.findFirst({
    where: {
      OR: [
        {
          invitedUserEmail: email,
        },
        {
          invitedUser: {
            email: email,
          },
        },
      ],
    },
  });

  if (existingInvite) {
    await context.entities.TeamInvites.delete({
      where: {
        id: existingInvite.id,
      },
    });
  }

  const invitedUserId = existingInvite?.invitedUser?.id;

  const newToken = await createRandomKey();

  if (invitedUserId) {
    const data = {
      invitedUser: { connect: { id: invitedUserId } },
      team: { connect: { id: teamId } },
      invitedBy: { connect: { id: context.user.id } },
      token: newToken,
    };

    // create a new invite
    await context.entities.TeamInvites.create({
      data,
    });

    await emailSender.send({
      to: email,
      subject: `You have been invited to join the team ${team.name}`,
      text: 'You should already be a member of the OpenSaas app. Please log in and accept the invite.',
      html: 'Hello <strong>world</strong>',
    });
  } else {
    const data = {
      invitedUserEmail: email,
      team: { connect: { id: teamId } },
      invitedBy: { connect: { id: context.user.id } },
      token: newToken,
    };

    // create a new invite
    await context.entities.TeamInvites.create({
      data,
    });

    await emailSender.send({
      to: email,
      subject: `You have been invited to join the team ${team.name}`,
      text: 'You should be a new user ',
      html: 'You need to register as a new user and then accept the invite. <a href="http://localhost:3000/signup">Register</a>',
    });
  }

  return {
    email: email,
    status: 'PENDING',
  };
};

export const acceptTeamInvite: AcceptTeamInvite = async (token: string, context: any) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const invite = await context.entities.TeamInvites.findFirst({
    where: {
      token: token,
    },
  });

  if (!invite) {
    throw new HttpError(404, 'Invite not found');
  }

  if (invite.invitedUserEmail) {
    if (invite.invitedUserEmail !== context.user.email) {
      throw new HttpError(400, 'Invite does not match user');
    }
  } else {
    if (invite.invitedUser?.email !== context.user.email) {
      throw new HttpError(400, 'Invite does not match user');
    }
  }

  // add to TeamMember
  await context.entities.TeamMember.create({
    data: {
      team: { connect: { id: invite.teamId } },
      user: { connect: { id: context.user.id } },
      status: 'MEMBER',
    },
  });

  // delete the invite
  await context.entities.TeamInvites.delete({
    where: {
      id: invite.id,
    },
  });

  return {
    status: 'ACCEPTED',
    teamId: invite.teamId,
  };
};
