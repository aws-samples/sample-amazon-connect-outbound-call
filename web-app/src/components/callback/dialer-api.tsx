import axios from "axios";

export const INITIATE_CALL_API_CALLS = `/api/call`;
export const GET_CALLS_API_CALLS = `/api/calls`;

export interface ICallDetails {
  instructionDate: string;
  companyName: string;
  valueDate: string;
  orderingAccountNumber: string;
  amt: string;
  beneficiaryAccountNumber: string;
  instructionFrom: string;
  beneficiaryName: string;
  beneficiaryBank: string;
}

export interface ICallRequest {
  messageId: string;
  requestDateTime: string;
  phoneNumber: string | undefined;
  language: string;
  details: ICallDetails;
}

export interface ICallbackForm {
  messageId: string;
  countryCode: string;
  phoneNumber: string;
  accountName: string;
  instructionDate: string;
  valueDate: string;
  orderingAccountNo: string;
  amt: string;
  beneAccountNo: string;
  instructionFrom: string;
  beneficiaryName: string;
  beneficiaryBank: string;
}

export const submitRequest = (callRequest: ICallRequest) => {
  console.log("Submit Request");

  axios.post(INITIATE_CALL_API_CALLS, { callRequest }).then((response) => {
    console.log(response.status);

    console.log(response.status);
    console.log(response.data);
    console.log(response.data.status);
  });
};

export function date_TO_String(date_Object: Date): string {
  // get the year, month, date, hours, and minutes seprately and append to the string.
  let date_String: string =
    String(date_Object.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date_Object.getDate() + 1).padStart(2, "0") +
    "-" +
    date_Object.getFullYear();
  return date_String;
}
