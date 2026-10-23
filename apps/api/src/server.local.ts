import app from "./app";

const apiPort = Number(process.env.PORT) || 3001;

app.listen(apiPort, () => {
  console.log(`API listening on http://localhost:${apiPort}`);
});
