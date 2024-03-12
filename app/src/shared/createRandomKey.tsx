import { randomBytes } from 'crypto';

export const createRandomKey = (): Promise<string> =>
  new Promise((resolve, reject) => {
    randomBytes(32, (error, buf) => {
      if (error) {
        return reject(error);
      }
      const token = buf.toString('hex');
      return resolve(token);
    });
  });
