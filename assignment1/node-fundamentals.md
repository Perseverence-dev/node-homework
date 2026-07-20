# Node.js Fundamentals

## What is Node.js?
Node.js is a Javascript runtime environment for running Javascript outside of browser.
Node.js has V8 engine to run javascript and also Node has additional API's for backend work.

## How does Node.js differ from running JavaScript in the browser?
Both Node and Javascript runs Javascript, but where it runs the environment differs.
Javascript is public code and run in the web browser, users can inspect code. JS has DOM, window object. JS access webpages and uses browser api's.
Node.js is run outside the browser, where it doesn't have window or browser object. It can access files and operating-system services. It can read protected server environment variables.

## What is the V8 engine, and how does Node use it?
V8 engine is developed by Google for Chrome to run javascript in the browser. Also Node embeds the V8 engine to run javascript outside of browser which has features such as OS files, Server files, etc...

## What are some key use cases for Node.js?
*To run Web servers and REST APIs  - Node can receive HTTP requests, process backend logic and produce json ot html responses.
*Real-time applications - Live dashboard, live chat
*Backend integration - Connect to databases, Call to external APIs
*Serverless functions - Node can run backend functions in cloud environments when receiving HTTP request or other event.

## Explain the difference between CommonJS and ES Modules. Give a code example of each.
CommonJS :
 - is a Traditional Node module system
 - imports with require()
 - exports with module.exports
ES Module:
 - is a standard JS module system
 - imports with import
 - exports with export
 -
**CommonJS (default in Node.js):**
```js
//mathUtils.js
function add(a,b){
    return a + b;
}

module.exports = {add};

//app.js
const { add } = require("./mathUtils");

console.log(add(2, 3));
```

**ES Modules (supported in modern Node.js):**
```js
// mathUtils.mjs
export function add(a, b) {
  return a + b;
}

// app.mjs
import { add } from "./mathUtils.mjs";

console.log(add(2, 3));

```