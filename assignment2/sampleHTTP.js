// Import Node's built-in HTTP module.
// No npm installation is required for this module.
const http = require("http");

/*
 * This HTML is returned by the GET /timePage route.
 *
 * The script inside this HTML runs in the browser:
 * 1. It waits for the user to click the button.
 * 2. It sends a GET request to /time.
 * 3. It converts the JSON response into a JavaScript object.
 * 4. It displays the returned time in the paragraph.
 */
const htmlString = `
<!DOCTYPE html>
<html>
<body>
<h1>Clock</h1>
<button id="getTimeBtn">Get the Time</button>
<p id="time"></p>
<script>
document.getElementById('getTimeBtn').addEventListener('click', async () => {
  const res = await fetch('/time');
  const timeObj = await res.json();
  console.log(timeObj);
  const timeP = document.getElementById('time');
  timeP.textContent = timeObj.time;
});
</script>
</body>
</html>
`;

// The callback runs once for every request received by the server.
// req contains information about the incoming request.
// res is used to construct and send the response.
const server = http.createServer((req, res) => {
  // Route: GET /time
  // Return the current time as JSON.
  if (req.method === "GET" && req.url === "/time") {
    // Set the success status code and identify the response as JSON.
    res.writeHead(200, {
      "Content-Type": "application/json",
    });

    // Convert the JavaScript object into JSON text,
    // send it to the client, and finish the response.
    res.end(
      JSON.stringify({
        time: new Date().toString(),
      }),
    );

  // Route: GET /timePage
  // Return an HTML page containing a button and browser JavaScript.
  } else if (req.method === "GET" && req.url === "/timePage") {
    // Identify the response as UTF-8 HTML.
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
    });

    // Send the HTML string and finish the response.
    res.end(htmlString);

  // Route: POST /echo
  // Read a JSON request body and send the same data back to the client.
  } else if (req.method === "POST" && req.url === "/echo") {
    // The request body can arrive in multiple data chunks.
    // This variable accumulates all the chunks.
    let body = "";

    // The "data" event runs whenever a new body chunk arrives.
    req.on("data", (chunk) => {
      body += chunk;
    });

    // The "end" event runs after the complete request body has arrived.
    req.on("end", () => {
      // Convert the collected JSON text into a JavaScript object.
      const parsedBody = JSON.parse(body);

      // Set the success status code and JSON response type.
      res.writeHead(200, {
        "Content-Type": "application/json",
      });

      // Return the received request body under the weReceived property.
      res.end(
        JSON.stringify({
          weReceived: parsedBody,
        }),
      );
    });
  }
});

// Start the HTTP server and listen for requests on port 8000.
server.listen(8000);