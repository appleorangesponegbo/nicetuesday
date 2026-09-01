// ive forgotten where exactly ive gotten this list from, but kudos to whoever made it :-)
const lightspeedjsonPromise = fetch('https://cdn.jsdelivr.net/gh/86ntnega/stunning-octo-fortnight/lightspeed.json').then(r => r.json());

function lightspeedCategorize(num, lightspeedjson) {
  for (let i = 0; i < lightspeedjson.length; i++) {
    if (lightspeedjson[i]["CategoryNumber"] == num) {
      return [lightspeedjson[i]["CategoryName"], (lightspeedjson[i]["Allow"] == 1)];
    }
  }
  return num;
}

async function lightspeedRaw(host) {
  const lightspeedjson = await lightspeedjsonPromise;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      "wss://production-gc.lsfilter.com?a=0ef9b862-b74f-4e8d-8aad-be549c5f452a&customer_id=74-1082-F000&agentType=chrome_extension&agentVersion=3.777.0&userGuid=00000000-0000-0000-0000-000000000000"
    );

    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: "dy_lookup",
        host: host,
        ip: "174.85.104.135",
        customerId: "74-1082-F000",
      }));
    };

    ws.onmessage = (event) => {
      ws.close();
      const json = JSON.parse(event.data);
      const category = lightspeedCategorize(json.cat, lightspeedjson);
      resolve(category ? category : ["Uncategorized", false]);
    };

    ws.onerror = (err) => {
      reject(new Error("WebSocket connection failed"));
    };
  });
}

async function lightspeed(host) {
  const [name, allowed] = await lightspeedRaw(host);
  const label = allowed
    ? `<b>Lightspeed</b> - <b style="color:green">Likely Allowed</b>`
    : `<b>Lightspeed</b> - <b style="color:red">Likely Blocked</b>`;
  return `${label}, ${name}`;
}

async function checker() {
  const url = document.getElementById("inputChecker").value;
  const result = document.getElementById("lightspeedResult");
  result.innerHTML = "<b>Lightspeed</b> - Checking...";

  let host;
  try {
    host = new URL(url.startsWith("http") ? url : "https://" + url).hostname;
  } catch {
    result.textContent = "Invalid URL";
    return;
  }

  try {
    const category = await lightspeed(host);
    result.innerHTML = category;
  } catch (err) {
    result.innerHTML = "Error: " + err.message;
  }
}
