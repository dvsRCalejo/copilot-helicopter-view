import { ReactNode, useEffect } from 'react';
import {
  MsalProvider,
  useMsal,
  useIsAuthenticated,
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from '@azure/msal-react';
import { PublicClientApplication, InteractionStatus } from '@azure/msal-browser';
import { isAuthConfigured, loginRequest, missingAuthConfig, msalConfig } from './msalConfig';
import {
  FluentProvider,
  webLightTheme,
  Spinner,
  Button,
  makeStyles,
  tokens,
  Text,
} from '@fluentui/react-components';

const msalInstance = isAuthConfigured ? new PublicClientApplication(msalConfig) : null;

const useStyles = makeStyles({
  loginPage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: tokens.spacingVerticalXL,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  loginCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalXXXL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
    maxWidth: '400px',
    width: '90%',
  },
  heading: {
    fontSize: tokens.fontSizeHero700,
  },
  title: {
    fontSize: tokens.fontSizeBase500,
  },
  sub: {
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
  missingList: {
    textAlign: 'left',
    width: '100%',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalM,
    boxSizing: 'border-box',
  },
});

function ConfigError() {
  const styles = useStyles();

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <Text className={styles.heading}>⚙️</Text>
        <Text className={styles.title} weight="bold">
          Missing webapp environment configuration
        </Text>
        <Text className={styles.sub}>
          Create a .env file in the webapp folder and provide the required values.
        </Text>
        <div className={styles.missingList}>
          {missingAuthConfig.map((key) => (
            <Text key={key} block>
              - {key}
            </Text>
          ))}
        </div>
        <Text className={styles.sub}>Use webapp/.env.example as the template, then restart the dev server.</Text>
      </div>
    </div>
  );
}

function LoginGate({ children }: { children: ReactNode }) {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const styles = useStyles();

  useEffect(() => {
    if (!isAuthenticated && inProgress === InteractionStatus.None) {
      instance.loginRedirect(loginRequest).catch(console.error);
    }
  }, [isAuthenticated, inProgress, instance]);

  if (inProgress !== InteractionStatus.None) {
    return (
      <div className={styles.loginPage}>
        <Spinner size="large" label="Signing in…" />
      </div>
    );
  }

  return (
    <>
      <AuthenticatedTemplate>{children}</AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <div className={styles.loginPage}>
          <div className={styles.loginCard}>
            <Text className={styles.heading}>🚁</Text>
            <Text weight="bold" size={600}>
              Copilot Helicopter View
            </Text>
            <Text className={styles.sub}>
              Sign in with your Microsoft account to view your Copilot Studio agents.
            </Text>
            <Button
              appearance="primary"
              size="large"
              onClick={() => instance.loginPopup(loginRequest).catch(console.error)}
            >
              Sign in
            </Button>
          </div>
        </div>
      </UnauthenticatedTemplate>
    </>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!msalInstance) {
    return (
      <FluentProvider theme={webLightTheme}>
        <ConfigError />
      </FluentProvider>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <FluentProvider theme={webLightTheme}>
        <LoginGate>{children}</LoginGate>
      </FluentProvider>
    </MsalProvider>
  );
}
