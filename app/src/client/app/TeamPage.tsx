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

import type { RouteComponentProps } from 'react-router-dom';
import type { FC } from 'react';

interface InviteUserFormProps {
  teamId: string;
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

const TeamPage = (props: RouteComponentProps<{ teamId: string }>) => {
  const { data: team, isLoading } = useQuery(getTeam, {
    teamId: props.match.params.teamId,
  });

  if (isLoading) {
    return <Container maxWidth='md'>Loading...</Container>;
  }

  if (!team) {
    return <Container maxWidth='md'>Team not found</Container>;
  }

  const pendingInvites = team.teamMembers.filter((member) => member.status === 'PENDING');
  const acceptedMembers = team.teamMembers.filter((member) => member.status !== 'PENDING');

  const handleResendInvite = async (userId: number) => {
    console.log('send invite');
    try {
      await sendVerificationEmail({ userId, teamId: team.team.id });
      console.log('sent');
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
              <Grid item>
                <Button color='error' variant='contained'>
                  Delete Team
                </Button>
              </Grid>
            </Grid>
          </div>

          <InviteUserForm teamId={props.match.params.teamId} />

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
                {acceptedMembers.map((member) => (
                  <TableRow key={member.user.id}>
                    <TableCell>{member.user.username}</TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell align='right'>{member.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {pendingInvites.length > 0 && (
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
                    {pendingInvites.map((member) => (
                      <TableRow key={member.user.id}>
                        <TableCell>{member.user.email}</TableCell>
                        <TableCell align='right'>
                          {member.status === 'PENDING' && (
                            <Button
                              variant='contained'
                              startIcon={<MailOutlineIcon />}
                              size='small'
                              onClick={() => handleResendInvite(member.user.id)}
                            >
                              Resend Invite
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Stack>
      </Box>
    </Container>
  );
};

export default TeamPage;
