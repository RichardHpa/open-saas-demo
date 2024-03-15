import { v4 as uuidv4 } from 'uuid';
import { getFirstProviderUserId } from 'wasp/auth';
import { type WebSocketDefinition, type WaspSocketData } from 'wasp/server/webSocket';

import { HttpError } from 'wasp/server';

const rooms = {};

export const webSocketFn: WebSocketFn = (io, context) => {
  io.on('connection', (socket) => {
    const username = getFirstProviderUserId(socket.data.user) ?? 'Unknown';
    console.log('a user connected: ', username);

    socket.on('joinTeam', ({ teamId }) => {
      socket.join(`teamChat-${teamId}`);
    });

    socket.on('chatMessage', async (msg, teamId) => {
      io.sockets
        .to(`teamChat-${teamId}`)
        .emit('chatMessage', { id: uuidv4(), username, text: msg, createdAt: new Date() });

      if (socket.data.user) {
        await context.entities.TeamChatMessages.create({
          data: {
            message: msg,
            team: { connect: { id: teamId } },
            user: { connect: { id: socket.data.user.id } },
          },
        });
      } else {
        console.log('No user found');
        throw new HttpError(401);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', {
        username,
        socketId: socket.id,
      });
    });
  });
};

// Typing our WebSocket function with the events and payloads
// allows us to get type safety on the client as well

type WebSocketFn = WebSocketDefinition<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
// type SocketId = `teamChat-${string}`;

interface joinTeamPayload {
  teamId: number;
  username: string;
}
interface ServerToClientEvents {
  chatMessage: (msg: { id: string; username: string; text: string; createdAt: Date }) => void;
  joinTeam: (user: { teamId: number; username: string }) => void;
}

interface ClientToServerEvents {
  chatMessage: (msg: string, teamId: number) => void;
  joinTeam: (teamId: joinTeamPayload) => void;
}

interface InterServerEvents {}

// Data that is attached to the socket.
// NOTE: Wasp automatically injects the JWT into the connection,
// and if present/valid, the server adds a user to the socket.
interface SocketData extends WaspSocketData {}
