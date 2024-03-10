import { useHistory } from 'react-router-dom';

import { createTeam } from 'wasp/client/operations';

import { Button, Grid, Container, Typography, Box, Card, Stack, TextField } from '@mui/material';

import type { User } from 'wasp/entities';

export default function AddTeamPage({ user }: { user: User }) {
  const history = useHistory();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get('name');
    if (!name) {
      window.alert('Name is required');
      return;
    }

    try {
      await createTeam({ name: name.toString() });

      history.push('/teams');
    } catch (err) {
      console.error(err);
      window.alert('Failed to create team');
    }
  };

  return (
    <Container maxWidth='md'>
      <Box sx={{ paddingTop: 4 }}>
        <Stack spacing={4} direction='column'>
          <div>
            <Grid container spacing={2} justifyContent='space-between' alignItems='flex-start'>
              <Grid item>
                <Typography variant='h4'>Add new team</Typography>
              </Grid>
            </Grid>
          </div>

          <Card sx={{ padding: 2 }}>
            <Box component='form' onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
              <TextField margin='normal' required fullWidth id='name' label='Team name' name='name' />
              <Button variant='contained' type='submit'>
                Add team
              </Button>
            </Box>
          </Card>
        </Stack>
      </Box>
    </Container>
  );
}
