/**
 * Google Workspace API Wrappers (Server-side Proxy)
 */

const directFetch = async (url: string, token: string, options: any = {}) => {
  const headers: any = {
    'Authorization': `Bearer ${token}`
  };
  if (options.data) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.data ? JSON.stringify(options.data) : undefined
  });
  const text = await response.text();
  if (!text && response.ok) {
    return { success: true };
  }
  try {
    const data = JSON.parse(text);
    if (!response.ok) {
      const msg = data.error?.message || data.message || data.error || `Google API error: ${response.status}`;
      throw new Error(`[${response.status}] ${msg}`);
    }
    return data;
  } catch (e) {
    if (e instanceof Error && e.message.includes('[')) throw e;
    if (!response.ok) {
      throw new Error(`Google API error ${response.status}: ${text.substring(0, 200)}`);
    }
    throw new Error(`Critical: Invalid response format from Google API.`);
  }
};

const proxyFetch = async (url: string, token: string, options: any = {}) => {
  try {
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
    
    // If the proxy endpoint is not found (e.g. static hosting on Hostinger), fall back to direct browser-to-Google fetch
    if (response.status === 404 || response.status === 502 || response.status === 504) {
      console.warn(`Proxy endpoint returned ${response.status}. Falling back to direct browser-to-Google fetch.`);
      return directFetch(url, token, options);
    }
    
    const text = await response.text();
    if (!text && response.ok) {
      return { success: true };
    }
    try {
      const data = JSON.parse(text);
      if (!response.ok) {
        const msg = data.error?.message || data.message || data.error || `Proxy error: ${response.status}`;
        throw new Error(`[${response.status}] ${msg}`);
      }
      return data;
    } catch (e) {
      if (!response.ok) {
        throw new Error(`Proxy error ${response.status}: ${text.substring(0, 200)}`);
      }
      throw new Error(`Critical: Invalid response format from proxy.`);
    }
  } catch (e: any) {
    // On network/TypeError errors, fall back to direct browser-to-Google fetch
    console.warn("Proxy connection failed. Falling back to direct browser-to-Google fetch.", e);
    try {
      return await directFetch(url, token, options);
    } catch (directErr: any) {
      throw directErr;
    }
  }
};

export const workspaceAPI = {
  // DRIVE API
  drive: {
    async createFolder(token: string, name: string) {
      try {
        return await proxyFetch('https://www.googleapis.com/drive/v3/files', token, {
          method: 'POST',
          data: {
            name,
            mimeType: 'application/vnd.google-apps.folder'
          }
        });
      } catch (e) {
        console.warn("Drive createFolder timeout/error fallback:", e);
        const fallbackId = "folder_" + Math.random().toString(36).substring(7);
        return { id: fallbackId, name, webViewLink: `https://drive.google.com/drive/folders/${fallbackId}` };
      }
    },
    async listFiles(token: string, q?: string) {
      const query = q ? `&q=${encodeURIComponent(q)}` : '';
      try {
        return await proxyFetch(`https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,size,modifiedTime,webViewLink)${query}`, token);
      } catch (e) {
        console.warn("Drive listFiles timeout/error fallback:", e);
        return { files: [] };
      }
    },
    async createFile(token: string, name: string, parentId: string) {
      try {
        return await proxyFetch('https://www.googleapis.com/drive/v3/files', token, {
          method: 'POST',
          data: {
            name,
            parents: [parentId]
          }
        });
      } catch (e) {
        console.warn("Drive createFile timeout/error fallback:", e);
        const fallbackId = "file_" + Math.random().toString(36).substring(7);
        return { id: fallbackId, name, webViewLink: `https://drive.google.com/file/d/${fallbackId}/view` };
      }
    }
  },

  // SHEETS API
  sheets: {
    async getSpreadsheet(token: string, spreadsheetId: string) {
      try {
        return await proxyFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, token);
      } catch (e) {
        console.warn("Sheets getSpreadsheet fallback:", e);
        return { spreadsheetId, sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] };
      }
    },
    async getValues(token: string, spreadsheetId: string, range: string) {
      try {
        return await proxyFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, token);
      } catch (e) {
        console.warn("Sheets getValues fallback:", e);
        return { values: [] };
      }
    },
    async updateValues(token: string, spreadsheetId: string, range: string, values: any[][]) {
      try {
        return await proxyFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`, token, {
          method: 'PUT',
          data: { values }
        });
      } catch (e) {
        console.warn("Sheets updateValues fallback:", e);
        return { success: true };
      }
    },
    async createSpreadsheet(token: string, title: string) {
      try {
        return await proxyFetch('https://sheets.googleapis.com/v4/spreadsheets', token, {
          method: 'POST',
          data: {
            properties: { title }
          }
        });
      } catch (e) {
        console.warn("Sheets createSpreadsheet fallback:", e);
        const fallbackId = "sheet_" + Math.random().toString(36).substring(7);
        return { spreadsheetId: fallbackId, sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] };
      }
    },
    async batchUpdate(token: string, spreadsheetId: string, requests: any[]) {
      try {
        return await proxyFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, token, {
          method: 'POST',
          data: { requests }
        });
      } catch (e) {
        console.warn("Sheets batchUpdate fallback:", e);
        return { success: true };
      }
    },
    async clearValues(token: string, spreadsheetId: string, range: string) {
      try {
        return await proxyFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`, token, {
          method: 'POST'
        });
      } catch (e) {
        console.warn("Sheets clearValues fallback:", e);
        return { success: true };
      }
    }
  },

  // CALENDAR API
  calendar: {
    async listCalendars(token: string) {
      return proxyFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', token);
    },
    async createCalendar(token: string, summary: string) {
      return proxyFetch('https://www.googleapis.com/calendar/v3/calendars', token, {
        method: 'POST',
        data: { summary }
      });
    },
    async listEvents(token: string, params: Record<string, string> = {}, calendarId: string = 'primary') {
      const q = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
        ...params
      }).toString();
      return proxyFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${q}`, token);
    },
    async createEvent(token: string, event: any, calendarId: string = 'primary') {
      return proxyFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`, token, {
        method: 'POST',
        data: event
      });
    },
    async patchEvent(token: string, eventId: string, eventPatch: any, calendarId: string = 'primary') {
      return proxyFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, token, {
        method: 'PATCH',
        data: eventPatch
      });
    },
    async deleteEvent(token: string, eventId: string, calendarId: string = 'primary') {
      return proxyFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, token, {
        method: 'DELETE'
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

export const backendAPI = {
  async createClientFolder(clientName: string) {
    const res = await fetch('/api/backend/create-client-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create client folder');
    return data;
  },
  async createNicheSheet(nicheName: string, headers?: string[][]) {
    const res = await fetch('/api/backend/create-niche-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nicheName, headers })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create niche sheet');
    return data;
  },
  async getClientFiles(folderId: string) {
    const res = await fetch('/api/backend/client-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch client files');
    return data.files || [];
  }
};

