let verifiedEmail: string | null = null;

export const cachedViewer = () => verifiedEmail;

export const rememberViewer = (email: string) => {
  verifiedEmail = email;
};

export const forgetViewer = () => {
  verifiedEmail = null;
};
