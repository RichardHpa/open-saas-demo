import { useState } from 'react';

import { Box, Grid, Paper, Typography, TextField, Stack, IconButton, Card } from '@mui/material';
import { PaperAirplane as PaperAirplaneIcon } from '../icons/paper-airplane';
import { useSocket, useSocketListener, ServerToClientPayload, ClientToServerPayload } from 'wasp/client/webSocket';

import type { FC } from 'react';

interface TeamChatProps {
  user: any;
  team: any;
}
// type SocketId = `teamChat-${string}`;
export const TeamChat: FC<TeamChatProps> = ({ user, team }) => {
  const socketId = `teamChat-${team.id}`;
  const [messageText, setMessageText] = useState<ClientToServerPayload<'chatMessage'>>('');
  const [messages, setMessages] = useState<ServerToClientPayload<'chatMessage'>[]>([]);

  // The "socket" instance is typed with the types you defined on the server.
  const { socket, isConnected } = useSocket();

  // This is a type-safe event handler: "chatMessage" event and its payload type
  // are defined on the server.
  useSocketListener('chatMessage', logMessage);

  function logMessage(msg: ServerToClientPayload<'chatMessage'>) {
    setMessages((priorMessages) => [msg, ...priorMessages]);
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    socket.emit('chatMessage', messageText, socketId);
    setMessageText('');
  };

  const messageList = messages.map((msg) => {
    const yourMessage = msg.username === user.username;
    return (
      <Box key={msg.id}>
        <Stack direction={yourMessage ? 'row-reverse' : 'row'} alignItems={yourMessage ? 'flex-end' : 'flex-start'}>
          <Card
            sx={{
              maxWidth: 500,
              backgroundColor: yourMessage ? 'primary.main' : 'background.paper',
              color: yourMessage ? 'primary.contrastText' : 'text.primary',
              borderRadius: 3,
              px: 2,
              py: 1,
            }}
            elevation={1}
          >
            <Stack direction='column' gap={1}>
              <Typography variant='subtitle2' sx={{ wordBreak: 'break-all' }}>
                {msg.username}
              </Typography>
              <Typography variant='body2' sx={{ wordBreak: 'break-all' }}>
                {msg.text}
              </Typography>
            </Stack>
          </Card>
        </Stack>
      </Box>
    );
  });
  const connectionIcon = isConnected ? '🟢' : '🔴';

  return (
    <Paper>
      <Box p={2}>
        <Typography variant='h6'>{connectionIcon} Team Chat</Typography>

        <Box sx={{ minHeight: 600, overflowY: 'scroll' }}>
          <Stack gap={2}>{messageList}</Stack>
          {/* <ul>{messageList}</ul> */}
        </Box>

        <Box component='form' onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs>
              <TextField
                size='small'
                fullWidth
                placeholder='Leave a message'
                name='message'
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
            </Grid>
            <Grid item>
              <IconButton type='submit' disabled={messageText.length === 0}>
                <PaperAirplaneIcon fontSize='small' sx={{ transform: 'rotate(45deg)' }} />
              </IconButton>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Paper>
  );
};
