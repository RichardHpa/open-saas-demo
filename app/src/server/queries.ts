import {
  type DailyStats,
  type GptResponse,
  type User,
  type PageViewSource,
  type Task,
  type File,
  type Team,
  type TeamInvites,
  type TeamChatMessages,
} from 'wasp/entities';
import { HttpError } from 'wasp/server';
import {
  type GetGptResponses,
  type GetDailyStats,
  type GetPaginatedUsers,
  type GetAllTasksByUser,
  type GetAllFilesByUser,
  type GetDownloadFileSignedURL,
  type GetAllTeamsForUser,
  type GetTeam,
  type GetInvitesForUser,
  type GetTeamChatMessages,
} from 'wasp/server/operations';
import { getDownloadFileSignedURLFromS3 } from './file-upload/s3Utils.js';

type DailyStatsWithSources = DailyStats & {
  sources: PageViewSource[];
};

type DailyStatsValues = {
  dailyStats: DailyStatsWithSources;
  weeklyStats: DailyStatsWithSources[];
};

export const getGptResponses: GetGptResponses<void, GptResponse[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.GptResponse.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
  });
};

export const getAllTasksByUser: GetAllTasksByUser<void, Task[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.Task.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

export const getAllFilesByUser: GetAllFilesByUser<void, File[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.File.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

export const getDownloadFileSignedURL: GetDownloadFileSignedURL<{ key: string }, string> = async (
  { key },
  _context
) => {
  return await getDownloadFileSignedURLFromS3({ key });
};

export const getDailyStats: GetDailyStats<void, DailyStatsValues> = async (_args, context) => {
  if (!context.user?.isAdmin) {
    throw new HttpError(401);
  }
  const dailyStats = await context.entities.DailyStats.findFirstOrThrow({
    orderBy: {
      date: 'desc',
    },
    include: {
      sources: true,
    },
  });

  const weeklyStats = await context.entities.DailyStats.findMany({
    orderBy: {
      date: 'desc',
    },
    take: 7,
    include: {
      sources: true,
    },
  });

  return { dailyStats, weeklyStats };
};

type GetPaginatedUsersInput = {
  skip: number;
  cursor?: number | undefined;
  hasPaidFilter: boolean | undefined;
  emailContains?: string;
  subscriptionStatus?: string[];
};
type GetPaginatedUsersOutput = {
  users: Pick<
    User,
    'id' | 'email' | 'username' | 'lastActiveTimestamp' | 'hasPaid' | 'subscriptionStatus' | 'stripeId'
  >[];
  totalPages: number;
};

export const getPaginatedUsers: GetPaginatedUsers<GetPaginatedUsersInput, GetPaginatedUsersOutput> = async (
  args,
  context
) => {
  let subscriptionStatus = args.subscriptionStatus?.filter((status) => status !== 'hasPaid');
  subscriptionStatus = subscriptionStatus?.length ? subscriptionStatus : undefined;

  const queryResults = await context.entities.User.findMany({
    skip: args.skip,
    take: 10,
    where: {
      email: {
        contains: args.emailContains || undefined,
        mode: 'insensitive',
      },
      hasPaid: args.hasPaidFilter,
      subscriptionStatus: {
        in: subscriptionStatus || undefined,
      },
    },
    select: {
      id: true,
      email: true,
      username: true,
      lastActiveTimestamp: true,
      hasPaid: true,
      subscriptionStatus: true,
      stripeId: true,
    },
    orderBy: {
      id: 'desc',
    },
  });

  const totalUserCount = await context.entities.User.count({
    where: {
      email: {
        contains: args.emailContains || undefined,
      },
      hasPaid: args.hasPaidFilter,
      subscriptionStatus: {
        in: subscriptionStatus || undefined,
      },
    },
  });
  const totalPages = Math.ceil(totalUserCount / 10);

  return {
    users: queryResults,
    totalPages,
  };
};

type GetAllTeamsForUserInput = {
  userId: string | number;
};
type GetAllTeamsForUserOutput = {
  team: Team;
  status: string;
};

export const getAllTeamsForUser: GetAllTeamsForUser<GetAllTeamsForUserInput, GetAllTeamsForUserOutput[]> = async (
  args,
  context
) => {
  // if your not logged in
  if (!context.user) {
    throw new HttpError(401);
  }

  // if you are not the user you are trying to get the teams for, we want to allow admins to get the teams for any user
  if (context.user.id !== args.userId) {
    throw new HttpError(401);
  }

  const userId = args.userId;
  const areTeamMembersOf = await context.entities.TeamMember.findMany({
    where: {
      userId,
    },
    select: {
      team: true,
      status: true,
    },
  });

  return areTeamMembersOf;
};

type GetTeamInput = {
  teamId: number;
};

type getTeamOutput = {
  team: Team;
  teamMembers: {
    user: User;
    status: string;
  }[];
  invitedMembers: TeamInvites[];
};

export const getTeam: GetTeam<GetTeamInput, getTeamOutput> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const team = await context.entities.Team.findFirst({
    where: {
      id: args.teamId,
    },
  });

  if (!team) {
    throw new HttpError(404);
  }

  const teamMembers = await context.entities.TeamMember.findMany({
    where: {
      teamId: args.teamId,
    },
    select: {
      user: true,
      status: true,
    },
  });

  const invitedMembers = await context.entities.TeamInvites.findMany({
    where: {
      teamId: args.teamId,
    },
  });

  return {
    team,
    teamMembers,
    invitedMembers,
  };
};

// look at types later
export const getInvitesForUser: GetInvitesForUser<void, any[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (context.user.onBoarded === false) {
    return await context.entities.TeamInvites.findMany({
      where: {
        invitedUserEmail: context.user.email,
      },
      include: {
        team: true,
        invitedBy: true,
      },
    });
  }

  return await context.entities.TeamInvites.findMany({
    where: {
      invitedUserId: context.user.id,
    },
    include: {
      team: true,
    },
  });
};

type GetTeamChatMessagesInput = {
  teamId: number;
};

type formattedMessages = {
  id: string;
  username: string | null;
  text: string;
  createdAt: Date;
};

type GetTeamChatMessagesOutput = {
  messages: formattedMessages[];
};

export const getTeamChatMessages: GetTeamChatMessages<GetTeamChatMessagesInput, GetTeamChatMessagesOutput> = async (
  args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const messages = await context.entities.TeamChatMessages.findMany({
    where: {
      teamId: args.teamId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
    include: {
      user: true,
    },
  });

  const formattedMessages = messages.map((message) => {
    return {
      id: message.id,
      username: message.user.username,
      text: message.message,
      createdAt: message.createdAt,
    };
  });
  return {
    messages: formattedMessages,
  };
};
