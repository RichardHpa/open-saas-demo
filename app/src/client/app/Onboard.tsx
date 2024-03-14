import { useQuery, getInvitesForUser, acceptTeamInvite, updateCurrentUser } from 'wasp/client/operations';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  Stack,
} from '@mui/material';

import DoneIcon from '@mui/icons-material/Done';
import CloseIcon from '@mui/icons-material/Close';

import type { FC } from 'react';
import type { User } from 'wasp/entities';

interface OnBoardProps {
  user: User;
}

const getInitials = (name: string) => {
  const [first, last] = name.split(' ');
  return first[0] + last[0];
};

export const OnBoard: FC<OnBoardProps> = ({ user }) => {
  const { data: invites } = useQuery(getInvitesForUser);
  const handleAcceptInvite = async (token: string) => {
    await acceptTeamInvite(token);
  };

  const handleDeclineInvite = (token: string) => {
    console.log('decline invite', token);
  };

  const handleContinue = () => {
    updateCurrentUser({ onBoarded: true });
  };

  return (
    <Dialog open maxWidth='md' fullWidth>
      <DialogTitle>Welcome to App</DialogTitle>
      <DialogContent>
        <DialogContentText>Welcome {user.email}</DialogContentText>
        <DialogContentText>Lets get you set up with the app</DialogContentText>

        <Box pt={5}>
          {invites && invites?.length > 0 ? (
            <div>
              <Typography variant='h5'>Pending Invites</Typography>
              <Typography>You have been invited to join the following teams:</Typography>
              <List>
                {invites.map((invite) => (
                  <ListItem
                    key={invite.id}
                    secondaryAction={
                      <Stack direction='row' gap={2}>
                        <IconButton
                          edge='end'
                          aria-label={`accept invite to ${invite.team.name}`}
                          onClick={() => handleAcceptInvite(invite.token)}
                        >
                          <DoneIcon />
                        </IconButton>
                        <IconButton
                          edge='end'
                          aria-label={`decline invite to ${invite.team.name}`}
                          onClick={() => handleDeclineInvite(invite.token)}
                        >
                          <CloseIcon />
                        </IconButton>
                      </Stack>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar>{getInitials(invite.team.name)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={invite.team.name} secondary={`invited by ${invite.invitedBy.email}`} />
                  </ListItem>
                ))}
              </List>
            </div>
          ) : (
            <Typography>Create a team</Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleContinue}>Continue</Button>
      </DialogActions>
    </Dialog>
  );
};
