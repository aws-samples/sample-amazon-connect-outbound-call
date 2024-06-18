import MainMenu from "./components/layout/MainMenu";
import Dialer from "./components/callback/Dialer";
import CallList from "./components/calllist/CallList";
import { Route, Routes } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
// Update the import statement for Auth
import { Auth } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { components } from "./components/login/loginComp";
import { setupAmplify } from "./aws-exports";

console.log("App started");

let credentials = null;

await setupAmplify().then((creds) => {
  console.log(`Amplify configured with ${JSON.stringify(creds)}`);
  credentials = creds;
});
Auth.configure(credentials);

function App() {
  // @ts-ignore

  return (
    <div>
      <Authenticator
        loginMechanisms={["username"]}
        signUpAttributes={["email"]}
        components={components}
        hideSignUp
      >
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MainMenu />
          <Routes>
            <Route path="/InitiateCallBack" element={<Dialer />}></Route>
            <Route path="/ListCalls" element={<CallList />}></Route>
            <Route path="/" element={<CallList />}></Route>
          </Routes>
        </LocalizationProvider>
      </Authenticator>
    </div>
  );
}

export default App;
