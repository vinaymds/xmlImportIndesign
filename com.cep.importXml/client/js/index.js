const socket = new WebSocket("ws://localhost:8080");
var csInterface = new CSInterface();
function onClickHandler() {
  csInterface.openURLInDefaultBrowser("http://localhost:3000/auth/google");
}
var token;

socket.addEventListener("message", (event) => {
  const message = event.data;
  socket.close();
  console.log(`Received: ${message}`);
  token = message;

  location.href = `home.html?token=${token}`;
});

socket.addEventListener("open", (event) => {
  console.log("Connected to WebSocket server");
});
socket.addEventListener("close", (event) => {
  console.log("Disconnected to WebSocket server");
});
