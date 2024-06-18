import * as React from "react";
import { useState, useEffect } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { Drawer } from "@mui/material";
import ListItemIcon from "@mui/material/ListItemIcon";
import CallIcon from "@mui/icons-material/Call";
import RingVolumeIcon from "@mui/icons-material/RingVolume";
import { Auth } from "aws-amplify";
import { setupAmplify } from "../../aws-exports";

type Anchor = "top" | "left" | "bottom" | "right";

let credentials = null
await setupAmplify().then((creds) => {
  console.log(`Amplify configured with ${JSON.stringify(creds)}`);
  credentials = creds
})
Auth.configure(credentials);

export default function MainMenu() {
  const [state, setState] = React.useState({
    top: false,
    left: false,
    bottom: false,
    right: false,
  });
  const [uname, getuname] = useState("");

  const fetchData = async () => {
    let session = await Auth.currentUserInfo();
    console.log("User info Session", session);
    getuname(session.attributes.email);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleDrawer =
    (anchor: Anchor, open: boolean) =>
    (event: React.KeyboardEvent | React.MouseEvent) => {
      if (
        event.type === "keydown" &&
        ((event as React.KeyboardEvent).key === "Tab" ||
          (event as React.KeyboardEvent).key === "Shift")
      ) {
        return;
      }

      setState({ ...state, [anchor]: open });
    };

  const list = (anchor: Anchor) => (
    <Box
      sx={{ width: anchor === "top" || anchor === "bottom" ? "auto" : 250 }}
      role="presentation"
      onClick={toggleDrawer(anchor, false)}
      onKeyDown={toggleDrawer(anchor, false)}
    >
      <List>
        <ListItem key="CALL" disablePadding>
          <ListItemButton href="/InitiateCallBack">
            <ListItemIcon>
              <CallIcon />
            </ListItemIcon>
            <ListItemText primary="Initiate Callback"></ListItemText>
          </ListItemButton>
        </ListItem>
        <ListItem key="LIST" disablePadding>
          <ListItemButton href="/ListCalls">
            <ListItemIcon>
              <RingVolumeIcon />
            </ListItemIcon>
            <ListItemText primary="Call Logs"></ListItemText>
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ bgcolor: "gray", flexGrow: 1 }}>
      <AppBar position="static"></AppBar>
      <Drawer
        anchor={"left"}
        open={state["left"]}
        onClose={toggleDrawer("left", false)}
      >
        {list("left")}
      </Drawer>
      <Toolbar>
        <IconButton
          size="large"
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2 }}
          onClick={toggleDrawer("left", true)}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Amazon Connect Outbound Call Prototype
        </Typography>
        <Button color="inherit">{uname}</Button>
      </Toolbar>
    </Box>
  );
}
