export class FsuHttpClient {
  /**
   * @param {any} xmlHttpRequest
   * @param {string} userAgent
   */
  constructor(xmlHttpRequest, userAgent) {
    this.xmlHttpRequest = xmlHttpRequest;
    this.userAgent = userAgent;
  }

  /**
   * @param {string} method
   * @param {string} url
   * @param {any} [body]
   * @param {string} [contentType]
   * @returns {Promise<any>}
   */
  request(method, url, body, contentType) {
    return new Promise((resolve, reject) => {
      this.xmlHttpRequest({
        method: method,
        url: url,
        data: body ? body : null,
        headers: {
          "User-Agent": this.userAgent,
          "Content-Type": contentType ? contentType : "application/json"
        },
        /** @param {any} res */
        onload: (res) => {
          if (res.status !== 200 && res.status !== 201) {
            reject(res.status);
            return;
          }
          resolve(res.responseText);
        },
        /** @param {any} error */
        onerror: (error) => {
          console.error("Request failed:", error);
          if (error.status) {
            reject(error.status);
          } else {
            reject("Unknown error occurred");
          }
        }
      });
    });
  }
}