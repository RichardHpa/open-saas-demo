import { useEffect } from 'react';
import { getTeam, useQuery, inviteTeamMember, sendVerificationEmail } from 'wasp/client/operations';

import {
  Button,
  Grid,
  Container,
  Typography,
  Box,
  Stack,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  TextField,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { TeamChat } from './TeamChat';
import { useSocket, useSocketListener, ServerToClientPayload, ClientToServerPayload } from 'wasp/client/webSocket';

import type { RouteComponentProps } from 'react-router-dom';
import type { FC } from 'react';

interface InviteUserFormProps {
  teamId: number;
}

const InviteUserForm: FC<InviteUserFormProps> = ({ teamId }) => {
  const handleOnSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = data.get('email');
    if (!email) {
      window.alert('Email is required');
      return;
    }

    try {
      await inviteTeamMember({ email, teamId });
    } catch (err) {
      console.error(err);
      window.alert('Failed to invite user to team');
    }
  };

  return (
    <Box>
      <form onSubmit={handleOnSubmit}>
        <Grid container spacing={2}>
          <Grid item xs>
            <TextField label='Email' name='email' fullWidth size='small' />
          </Grid>
          <Grid item>
            <Button type='submit' variant='contained' startIcon={<MailOutlineIcon />}>
              Invite user
            </Button>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

const TeamPage = (props: any) => {
  const user = props.user;

  const parsedTeamId = Number(props.match.params.teamId);
  const { data: team, isLoading } = useQuery(getTeam, {
    teamId: parsedTeamId,
  });

  const { socket } = useSocket();

  useEffect(() => {
    if (!team) return;
    console.log('joining team', team.team.id, user.username);
    socket.emit('joinTeam', { teamId: team.team.id, username: user.username });
  }, [team]);

  if (isLoading) {
    return <Container maxWidth='md'>Loading...</Container>;
  }

  if (!team) {
    return <Container maxWidth='md'>Team not found</Container>;
  }

  // check if you are an admin of the team
  const isAdmin = team.teamMembers.some((member) => member.user.id === user.id && member.status === 'ADMIN');

  const handleResendInvite = async (email: string) => {
    if (!email) return;
    try {
      await sendVerificationEmail({ email, teamId: team.team.id });
    } catch (err) {
      console.error(err);
      window.alert('Failed to resend invite');
    }
  };

  return (
    <Container maxWidth='md'>
      <Box sx={{ paddingTop: 4 }}>
        <Stack spacing={4} direction='column'>
          <div>
            <Grid container spacing={2} justifyContent='space-between' alignItems='flex-start'>
              <Grid item>
                <Typography variant='h4'>{team.team.name}</Typography>
              </Grid>
              {isAdmin && (
                <Grid item>
                  <Button color='error' variant='contained'>
                    Delete Team
                  </Button>
                </Grid>
              )}
            </Grid>
          </div>

          {isAdmin && <InviteUserForm teamId={parsedTeamId} />}

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell align='right'>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {team.teamMembers.map((member) => (
                  <TableRow key={member.user.id}>
                    <TableCell>{member.user.username}</TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell align='right'>{member.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {team?.invitedMembers.length > 0 && (
            <Box>
              <Typography variant='h5' gutterBottom>
                Pending Invites
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell align='right'></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {team.invitedMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.invitedUserEmail}</TableCell>
                        <TableCell align='right'>
                          <Button
                            variant='contained'
                            startIcon={<MailOutlineIcon />}
                            size='small'
                            onClick={() => handleResendInvite(member.invitedUserEmail || '')}
                          >
                            Resend Invite
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          <Box>
            <TeamChat user={user} team={team.team} />
          </Box>
        </Stack>
      </Box>
    </Container>
  );
};

export default TeamPage;
