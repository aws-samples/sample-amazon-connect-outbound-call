/*
Copyright 2024 Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
*/
import {
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Paper,
  Switch,
  IconButton,
} from "@mui/material";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import * as React from "react";
import Grid from "@mui/material/Grid";
import Alert from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import CachedIcon from "@mui/icons-material/Cached";
import {
  INITIATE_CALL_API_CALLS,
  ICallDetails,
  ICallRequest,
  ICallbackForm,
  date_TO_String,
} from "./dialer-api";
import axios from "axios";
import { Auth } from "aws-amplify";
import { useEffect } from "react";
const IDD_List: string[] = ["+65", "+61", "+852"];

// let credentials = null
// await setupAmplify().then((creds) => {
//   console.log(`Amplify configured with ${JSON.stringify(creds)}`);
//   credentials = creds
// })
// Auth.configure(credentials);

let session: any = null;

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const callbackForm: ICallbackForm = {
  messageId: generateUUID(),
  prefix: IDD_List[0],
  phoneNumber: " ",
  accountName: "Silver Lake",
  instructionDate: date_TO_String(new Date()),
  valueDate: date_TO_String(new Date()),
  orderingAccountNo: "41547308",
  amt: "123456789",
  beneAccountNo: "60705102",
  instructionFrom: "555-6969",
  beneficiaryName: "Blue Mountain Inc.",
  beneficiaryBank: "Any Bank Inc.",
};

const callDetail: ICallDetails = {
  companyName: "",
  instructionDate: "",
  valueDate: "",
  orderingAccountNumber: "",
  amt: "",
  beneficiaryAccountNumber: "",
  instructionFrom: "",
  beneficiaryName: "",
  beneficiaryBank: "",
};

const callRequest: ICallRequest = {
  messageId: generateUUID(),
  requestDateTime: new Date().toISOString(),
  phoneNumber: undefined,
  language: "en",
  details: callDetail,
};

/**
 * Helper function to copy Form Value to Request Object
 * @param aForm
 * @param aReq
 */
export function copyForm(aForm: ICallbackForm, aReq: ICallRequest) {
  aReq.phoneNumber = aForm.prefix.concat(aForm.phoneNumber);
  aReq.details.companyName = aForm.accountName;
  aReq.details.instructionDate = aForm.instructionDate;
  aReq.details.valueDate = aForm.valueDate;
  aReq.details.orderingAccountNumber = aForm.orderingAccountNo;
  aReq.details.beneficiaryAccountNumber = aForm.beneAccountNo;
  aReq.details.amt = aForm.amt;
  aReq.details.instructionFrom = aForm.instructionFrom;
  aReq.details.beneficiaryName = aForm.beneficiaryName;
  aReq.details.beneficiaryBank = aForm.beneficiaryBank;
  aReq.messageId = aForm.messageId;
}

// Initialized the CallRequest
copyForm(callbackForm, callRequest);

const jsonString: String = JSON.stringify(callRequest, null, 3);

export default function Dialer() {
  const fetchData = async () => {
    session = await Auth.currentSession();
    console.log("session", session);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [formData, setFormData] = React.useState<ICallbackForm>(callbackForm);

  const [payload, setPayload] = React.useState<String>(jsonString);

  const [showPayload, setShowPayload] = React.useState("block");

  const [checked, setChecked] = React.useState(true);

  const updatePayload = (value: ICallbackForm) => {
    console.log("Update");
    callRequest.messageId = generateUUID();
    callRequest.requestDateTime = new Date().toISOString();

    // Updating PayLoad based on Form Data
    copyForm(value, callRequest);
  };

  const onFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("onFormChange");

    const target = event.target as HTMLInputElement;
    const value = target.value;
    const name = target.name;
    console.log(name + " : " + value);

    const newFormValues: ICallbackForm = { ...formData, [name]: value };

    updatePayload(newFormValues);
    setPayload(JSON.stringify(callRequest, null, 3));

    setFormData(newFormValues);
  };

  const submitCall = async (_event: any) => {
    try {
      const response = await axios.post(INITIATE_CALL_API_CALLS, callRequest, {
        headers: { Authorization: session.getIdToken().getJwtToken() },
      });
      let httpResponse = response.status;
      console.log("Response: %d", httpResponse);
      setShowSuccess(true);
      setShowError(false);
    } catch (error) {
      console.error(error);
      setShowError(true);
      setShowSuccess(false);
    }
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event.target.checked);
    if (event.target.checked) {
      setShowPayload("block");
    } else {
      setShowPayload("none");
    }
    setChecked(event.target.checked);
  };

  const generateMessageId = () => {
    const name = "messageId";
    const value = generateUUID();
    const newFormValues: ICallbackForm = { ...formData, [name]: value };
    setFormData(newFormValues);
    updatePayload(newFormValues);
    setPayload(JSON.stringify(callRequest, null, 3));
    console.log("generated message id: " + formData.messageId);
  };

  const [showSuccess, setShowSuccess] = React.useState(false);
  const [showError, setShowError] = React.useState(false);

  return (
    <Paper
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography component="h2" variant="h6" color="primary" gutterBottom>
        Initiate Outbound Call
      </Typography>
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Collapse in={showSuccess}>
              <Alert
                severity="success"
                onClose={() => {
                  setShowSuccess(false);
                }}
              >
                Request Submitted
              </Alert>
            </Collapse>
            <Collapse in={showError}>
              <Alert
                severity="error"
                onClose={() => {
                  setShowError(false);
                }}
              >
                Error while submitting request
              </Alert>
            </Collapse>
          </Grid>
          <Grid item xs={6}>
            {/* Forms Goes here */}
            <FormControl fullWidth={true}>
              <Typography
                variant="subtitle1"
                color="primary"
                align="center"
                gutterBottom
              >
                Call Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormLabel>Country Code</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <RadioGroup
                    name="prefix"
                    row
                    defaultValue={IDD_List[0]}
                    onChange={onFormChange}
                  >
                    {IDD_List.map((countryCode) => (
                      <FormControlLabel
                        value={countryCode}
                        control={<Radio />}
                        label={countryCode}
                        key={countryCode}
                      />
                    ))}
                  </RadioGroup>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Message Id</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="messageId"
                    id="messageId"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.messageId}
                  ></TextField>
                  <IconButton
                    aria-label="delete"
                    size="small"
                    onClick={generateMessageId}
                  >
                    <CachedIcon fontSize="small" />
                  </IconButton>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Phone Number</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="phoneNumber"
                    id="phoneNumber"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.phoneNumber}
                  ></TextField>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Sender Fax Number</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="instructionFrom"
                    id="instructionFrom"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.instructionFrom}
                  ></TextField>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Company Name</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="accountName"
                    id="accountName"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.accountName}
                  ></TextField>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Instruction Date</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="instructionDate"
                    id="instructionDate"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.instructionDate}
                  ></TextField>
                  {/* <DateField
                  format="MM-DD-YYYY"
                  size="small"
                  value={"01-01-1975"}
                  onChange={(newValue) => onDateChange(newValue)}
                /> */}
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Value Date</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="valueDate"
                    id="valueDate"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.valueDate}
                  ></TextField>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Ordering Account Number</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="orderingAccountNo"
                    id="orderingAccountNo"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.orderingAccountNo}
                  ></TextField>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Beneficiary Bank</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="beneficiaryBank"
                    id="beneficiaryBank"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.beneficiaryBank}
                  ></TextField>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Beneficiary Name</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="beneficiaryName"
                    id="beneficiaryName"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.beneficiaryName}
                  ></TextField>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Benefeciary Account Number</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="beneAccountNo"
                    id="beneAccountNo"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.beneAccountNo}
                  ></TextField>
                </Grid>
                <Grid item xs={6}>
                  <FormLabel>Instruction Amount</FormLabel>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="amt"
                    id="amt"
                    type="text"
                    size="small"
                    onChange={onFormChange}
                    value={formData.amt}
                  ></TextField>
                </Grid>
              </Grid>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle1" align="left" gutterBottom>
              Show Message Payload
              <Switch
                checked={checked}
                onChange={handleCheckboxChange}
                inputProps={{ "aria-label": "controlled" }}
              />
            </Typography>

            <div style={{ display: showPayload }}>
              <Typography
                variant="subtitle1"
                color="primary"
                align="center"
                gutterBottom
              >
                Message Payload
              </Typography>
              <TextField
                id="jsonPayload"
                fullWidth={true}
                multiline
                minRows={18}
                maxRows={18}
                value={payload}
              />
            </div>
          </Grid>

          <Grid item xs={12}>
            <div>
              <center>
                <Button variant="contained" onClick={submitCall}>
                  Submit
                </Button>
              </center>
            </div>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}
