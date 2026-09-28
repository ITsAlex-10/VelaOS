/**
 * Google Workspace API Wrappers (Server-side Proxy)
 */

const proxyFetch = async (url: string, token: string, options: any = {}) => {
  const response = await fetch('/api/workspace/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url,
      method: options.method || 'GET',
      data: options.data,
      token
    })
  });
  
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (!response.ok) {
      // Standardize error message from Google API format
      const msg = data.error?.message || data.message || data.error || `Proxy error: ${response.status}`;
      throw new Error(`[${response.status}] ${msg}`);
    }
    return data;
  } catch (e) {
    if (e instanceof Error && e.message.includes('Proxy error')) throw e; // Already handled
    
    if (!response.ok) {
      throw new Error(`Proxy error ${response.status}: ${text.substring(0, 200)}`);
    }
    throw new Error(`Critical: Invalid response format from proxy. Token or URL might be invalid.`);
  }
};

export const workspaceAPI = {
  // DRIVE API
  drive: {
    async createFolder(token: string, name: string) {
      return proxyFetch('https://www.googleapis.com/drive/v3/files', token, {
        method: 'POST',
        data: {
          name,
          mimeType: 'application/vnd.google-apps.folder'
        }
      });
    },
    async listFiles(token: string, q?: string) {
      const query = q ? `&q=${encodeURIComponent(q)}` : '';
      return proxyFetch(`https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,size,modifiedTime,webViewLink)${query}`, token);
    },
    async createFile(token: string, name: string, parentId: string) {
      return proxyFetch('https://www.googleapis.com/drive/v3/files', token, {
        method: 'POST',
        data: {
          name,
          parents: [parentId]
        }
      });
    }
  },

  // SHEETS API
  sheets: {
    async getSpreadsheet(token: string, spreadsheetId: string) {
      return proxyFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, token);
    },
    async getValues(token: string, spreadsheetId: string, range: string) {
      return proxyFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, token);
    },
    async updateValues(token: string, spreadsheetId: string, range: string, values: any[][]) {
      return proxyFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`, token, {
        method: 'PUT',
        data: { values }
      });
    },
    async createSpreadsheet(token: string, title: string) {
      return proxyFetch('https://sheets.googleapis.com/v4/spreadsheets', token, {
        method: 'POST',
        data: {
          properties: { title }
        }
      });
    }
  },

  // CALENDAR API
  calendar: {
    async listEvents(token: string, params: Record<string, string> = {}) {
      const q = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
        ...params
      }).toString();
      return proxyFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, token);
    },
    async createEvent(token: string, event: any) {
      return proxyFetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', token, {
        method: 'POST',
        data: event
      });
    }
  },

  // CHAT API
  chat: {
    async listSpaces(token: string) {
      return proxyFetch('https://chat.googleapis.com/v1/spaces', token);
    },
    async createSpace(token: string, space: any) {
      return proxyFetch('https://chat.googleapis.com/v1/spaces', token, {
        method: 'POST',
        data: space
      });
    },
    async listMessages(token: string, spaceId: string) {
      return proxyFetch(`https://chat.googleapis.com/v1/${spaceId}/messages`, token);
    },
    async listMembers(token: string, spaceId: string) {
      return proxyFetch(`https://chat.googleapis.com/v1/${spaceId}/members`, token);
    },
    async createMessage(token: string, spaceId: string, text: string) {
      return proxyFetch(`https://chat.googleapis.com/v1/${spaceId}/messages`, token, {
        method: 'POST',
        data: { text }
      });
    }
  }
};
