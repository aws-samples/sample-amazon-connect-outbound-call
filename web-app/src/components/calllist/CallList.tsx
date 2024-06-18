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
import * as React from "react";
import { IconButton, Paper, Tooltip } from "@mui/material";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { styled } from "@mui/material/styles";
import axios from "axios";
import { GET_CALLS_API_CALLS } from "../callback/dialer-api";
import VoicemailIcon from "@mui/icons-material/Voicemail";
import { useEffect } from "react";
import { Auth } from "aws-amplify";

// @ts-ignore
let session: any = null;

function downloadWav(record_url: string) {
  console.log("Download ");
  console.log(record_url);
  const aTag = document.createElement("a");
  aTag.href = record_url;
  aTag.setAttribute("download", "Recording");
  document.body.appendChild(aTag);
  aTag.click();
  aTag.remove();
}

const columns: GridColDef[] = [
  { field: "contactId", headerName: "Contact Id", width: 200 },
  { field: "messageId", headerName: "Message Id", width: 200 },
  {
    field: "phoneNumber",
    headerName: "Phone Number",
    width: 150,
    editable: false,
  },
  {
    field: "language",
    headerName: "Language",
    width: 100,
    editable: false,
  },
  {
    field: "firstName",
    headerName: "First Name",
    width: 100,
    editable: false,
  },
  {
    field: "lastName",
    headerName: "Last Name",
    width: 100,
    editable: false,
  },
  {
    field: "requestTime",
    headerName: "Request Time",
    width: 200,
    editable: false,
  },
  {
    field: "callDuration",
    headerName: "Duration",
    type: "number",
    width: 70,
    editable: false,
  },
  {
    field: "response",
    headerName: "Response",
    width: 150,
    editable: false,
  },
  {
    field: "status",
    headerName: "Flow Status",
    width: 150,
    type: "singleSelect",
    valueOptions: ["REQUESTED", "COMPLETED"],
    editable: false,
  },
  {
    field: "connectStatus",
    headerName: "Call Status",
    width: 150,
    editable: false,
  },
  {
    field: "audioFile",
    headerName: "Audio",
    description: "Audio Recording",
    sortable: false,
    width: 75,
    editable: false,
    renderCell: (params) => {
      return (
        params.value.length > 0 && (
          <Tooltip title={params.row.transcribe}>
            <IconButton onClick={() => downloadWav(params.value)}>
              <VoicemailIcon />
            </IconButton>
          </Tooltip>
        )
      );
    },
  },
];

const StyledDataGrid = styled(DataGrid)(({ theme }) => ({
  border: 0,
  color:
    theme.palette.mode === "light"
      ? "rgba(0,0,0,.85)"
      : "rgba(255,255,255,0.85)",
  fontFamily: [
    "-apple-system",
    "BlinkMacSystemFont",
    '"Segoe UI"',
    "Roboto",
    '"Helvetica Neue"',
    "Arial",
    "sans-serif",
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"',
  ].join(","),
  WebkitFontSmoothing: "auto",
  letterSpacing: "normal",
  "& .MuiDataGrid-columnsContainer": {
    backgroundColor: theme.palette.mode === "light" ? "#fafafa" : "#1d1d1d",
  },
  "& .MuiDataGrid-iconSeparator": {
    display: "none",
  },
  "& .MuiDataGrid-columnHeader, .MuiDataGrid-cell": {
    borderRight: `1px solid ${
      theme.palette.mode === "light" ? "#f0f0f0" : "#303030"
    }`,
  },
  "& .MuiDataGrid-columnsContainer, .MuiDataGrid-cell": {
    borderBottom: `1px solid ${
      theme.palette.mode === "light" ? "#f0f0f0" : "#303030"
    }`,
  },
  "& .MuiDataGrid-cell": {
    color:
      theme.palette.mode === "light"
        ? "rgba(0,0,0,.85)"
        : "rgba(255,255,255,0.65)",
  },
  "& .MuiPaginationItem-root": {
    borderRadius: 0,
  },
}));

export default function CallList() {
  const fetchData = async () => {
    session = await Auth.currentSession();
    console.log("User info", session);
    setSess(session);
    getCallLogs();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [callLogs, setCallLogs] = React.useState([]);
  const [, setLoadingState] = React.useState(true);
  const [, setSess] = React.useState<any>();

  const getCallLogs = async () => {
    try {
      console.log("Getting Records...", session);
      const response = await axios.get(GET_CALLS_API_CALLS, {
        headers: {
          Authorization: session.getIdToken().getJwtToken(),
        },
      });
      console.log(response);
      setCallLogs(response.data);
      setLoadingState(false);
      return response.data;
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Paper
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography component="h2" variant="h6" color="primary" gutterBottom>
        Call Logs
      </Typography>
      <Box sx={{ height: "75%", width: "100%" }}>
        <StyledDataGrid
          autoHeight
          getRowHeight={() => "auto"}
          //@ts-ignore
          rows={callLogs}
          columns={columns}
          // loading={isFetching}
          initialState={{
            sorting: {
              sortModel: [{ field: "requestTime", sort: "desc" }],
            },
            pagination: {
              paginationModel: {
                pageSize: 25,
              },
            },
          }}
          pageSizeOptions={[25]}
          // checkboxSelection
          disableRowSelectionOnClick
          getRowId={(row: any) => row?.contactId}
        />
      </Box>
    </Paper>
  );
}
