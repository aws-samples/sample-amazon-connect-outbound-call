import { Text, useTheme, View, Image, Heading } from '@aws-amplify/ui-react';
import paceLogo from '../../assets/pace-grey.png';

export const components = {
    Header() {
      const { tokens } = useTheme();
  
      return (
        <View textAlign="center" padding={tokens.space.large}>
          <Image
            alt="PACE Connect Prototype"
            src={paceLogo}
            padding={tokens.space.medium}
          />
          <Text
              variation="info"
              as="strong"
              lineHeight="1.5em"
              fontWeight={400}
              fontSize="2em"
              fontStyle="normal"
              textDecoration="none"
              width="30vw"
            >
              PACE Connect Prototype
          </Text>
        </View>
  
  
      );
    },
  
    Footer() {
      const { tokens } = useTheme();
  
      return (
        <View textAlign="center" padding={tokens.space.large}>
          <Text color={tokens.colors.neutral[80]}>
            &copy; All Rights Reserved
          </Text>
        </View>
      );
    },
  
    SignIn: {
      Header() {
        const { tokens } = useTheme();
  
        return (
          <Heading level={3} padding={`${tokens.space.xl} ${tokens.space.xl} 0`}>
          Sign in to your Account
        </Heading>
        );
      },
    }
  
  }
  