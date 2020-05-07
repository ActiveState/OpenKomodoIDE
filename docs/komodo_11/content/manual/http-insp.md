---
title: HTTP Inspector
---
(Komodo IDE only)

The **HTTP Inspector** is used to examine HTTP requests and responses as they happen. It runs a local proxy service to intercept HTTP traffic and display each transaction.

Transactions highlighted in the **Transaction** table are displayed in detail in the **Request** and **Response** panes below.

<a name="http_start_inspector" id="http_start_inspector"></a>
## Starting the HTTP Inspector

The HTTP Inspector runs a local proxy for intercepting HTTP traffic. Start the proxy by opening the HTTP Inspector (**Tools** > **HTTP Inspector**) and selecting the **Start** button on the **Inspector** toolbar.

Alternatively, set Komodo to start the HTTP Inspector proxy automatically at startup. Under **Preferences** > **HTTP Inspector**, select **Run HTTP Inspector in the background when Komodo starts up**. If you want to run the Inspector on a port other than 8080 (the default) specify it in the **Listen on port** field.

If you are working behind a web proxy (i.e. at your network gateway) you can specify the hostname and port of the proxy for the HTTP Inspector to forward connections through. Select **Enable proxy forwarding** and enter the hostname and port (e.g. `host.example.org:18080`) of the proxy. If no port is specified Komodo will attempt to use port 8080.

<a name="http_browser_connect" id="http_browser_connect"></a>
## Connecting the Browser

Once the HTTP Inspector is running, your browser must be configured to connect to it. Set the browser's internet connection settings to point to the HTTP proxy on `localhost:8080` (default). If you've set the Inspector to use a different port, use the port specified above in **Preferences** > **HTTP Inspector**. If you are running the browser on a different machine, specify the hostname of the system running Komodo.

Debugging HTTP connections may require you to switch back and forth from using the Inspector to making a direct connection to the internet. If this is the case you may find it useful to configure a separate browser for debugging HTTP, or use a browser plugin that allows you to change your proxy configuration quickly.

**Note**: The HTTP Inspector does not unencrypt HTTPS (encrypted) sessions.

<a name="http_inspect" id="http_inspect"></a>
## Inspecting the HTTP Data

Once Komodo and your browser have been configured to debug HTTP sessions, load the page you are trying to analyze:

1.  If it is not already running, [start the HTTP Inspector](#http_start_inspector)
1.  Load the page in the browser
1.  Watch the HTTP transactions (request/response pairs).
1.  Select a transaction to view details in the **Request** and **Response** panes. A data dump of the transactions can be seen in the data buffer panes below.

By default, the **Transaction** table shows the following columns:

- State: This appears blank for an uninterrupted transaction. If a [Break on Request/Response](#http_break) has been selected, an icon will appear in this column indicating the break state of the current transaction (Request or Response).
- Time: Time of the transaction.
- Duration: How long the transaction took.
- Method: HTTP method used (GET, POST, etc.)
- Status: Status returned by the server.
- Size: Amount of data transferred in bytes (content-length.
- Content: MIME content-type.
- URL: Full URL of the target.

<a name="http_break" id="http_break"></a>
## Break on Request/Response

Selecting **Break on every Request** ![](/images/break_request.png) or **Break on every Response** ![](/images/break_response.png) in the toolbar will stop on the appropriate part of the next transaction. The request or response can then be edited before being submitted. The current break state of the transaction will appear in the **State** column in the main Inspector window.

<a name="edit_transaction" id="edit_transaction"></a>
### Editing a Request/Response

All fields, headers and data buffers in the **Request** and **Response** panes are editable in the relevant break state.

If the response is returned in a compressed format (i.e. the response headers contain a "gzip" content-encoding) the unzipped data will be displayed in the data buffer. If any modifications are made, the data will be re-compressed before being passed back to the browser.

When modifying request or response data, the content-length header will be automatically modified to match the length of data in the corresponding data buffer.

<a name="http_ruleset" id="http_ruleset"></a>
## Rules

Rules perform specified actions when a certain HTTP request or response is detected. They can be created (**New**), edited (**Edit**), removed (**Delete**) and ordered (**Move Up** and **Move Down**). The order of the rules can be important as all matching rules are processed sequentially.

The following parameters can be set for each rule:

- **Rule Name**: Arbitrary name for the rule.
- **Rule Type**: Match on a request, a response, or either one.
- **Tests**: The match criteria for triggering a rule.
    - **Match on all|any of the following**: One or more match criteria can be set. This option selects whether the match should apply to **all** or **any** of the match criteria.
    - **Request/Response part to match**: The rule can match against the URL, Method, Status, Version, Header or Data fields of an HTTP Request or Response.
    - **Match type**: Use **contains** for a substring match or **regex** for a regular expression pattern (Python syntax)
    - **Match string**: The string or pattern which triggers the rule.
- **Actions**: Specifies one or more actions to be taken once a rule is triggered. The following actions are available:
    - **Break**: [Breaks](#http_break) at the point the rule is triggered. The HTTP Inspector window must be open for the break to occur.
    - **Delay**: Delays the request or response by a specified number of seconds. Use up to three decimal places to specify milliseconds (e.g. 0.001 = 1 ms). Use **literal** to specify the exact value, or **random** to set a range.
    - **Timeout**: Wait for the HTTP timeout.
    - **Modify Field**: Change the value of a Method, URL, Client IP, Status or Data.
    - **Set Header**: Add a new header or change the value of an existing one.
    - **Remove Header**: Remove a named header.
