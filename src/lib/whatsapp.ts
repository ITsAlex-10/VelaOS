import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from './firebase';

// Interface representing the normalized WhatsApp Message schema
export interface WhatsAppMessage {
  id: string;
  sender: 'client' | 'user' | 'system';
  text: string;
  time: string;
  createdAt: any; // Server Timestamp
  isAutomatic: boolean;
  instanceId: string;
}

/**
 * Normalizes any phone number by stripping all non-digit characters.
 * E.g., "+351 912-345-678" -> "351912345678"
 */
export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

/**
 * Checks if two normalized phone numbers match, accounting for common international 
 * suffix variations (e.g., matching a local number '912345678' with international '351912345678').
 */
export const isPhoneMatch = (phoneA: string, phoneB: string): boolean => {
  const normA = normalizePhone(phoneA);
  const normB = normalizePhone(phoneB);
  
  if (!normA || !normB) return false;
  
  // If they are identical, it is an instant match
  if (normA === normB) return true;
  
  // Check if one is a suffix of the other (e.g. "912345678" matches "351912345678")
  // Typically local Portuguese numbers have 9 digits. We check the last 9 digits.
  const suffixLen = 9;
  if (normA.length >= suffixLen && normB.length >= suffixLen) {
    return normA.slice(-suffixLen) === normB.slice(-suffixLen);
  }
  
  return false;
};

/**
 * Finds a client in Firestore whose phone number matches the normalized incoming phone number.
 */
export const findClientByPhone = async (incomingPhone: string): Promise<any | null> => {
  const normalizedIncoming = normalizePhone(incomingPhone);
  if (!normalizedIncoming) return null;

  try {
    const clientsRef = collection(db, 'clients');
    const snapshot = await getDocs(clientsRef);
    
    // We scan and check matching clients in memory to handle prefix mismatches (e.g., country codes)
    for (const d of snapshot.docs) {
      const clientData = d.data();
      if (clientData.phone && isPhoneMatch(clientData.phone, normalizedIncoming)) {
        return { id: d.id, ...clientData };
      }
    }
  } catch (error) {
    console.error('[WHATSAPP SERVICE] Error searching client by phone:', error);
  }
  
  return null;
};

/**
 * Processes incoming webhook payloads from Evolution API, Z-API, or Meta API
 * and registers the message under the matching client's subcollection in Firestore.
 */
export const handleIncomingMessage = async (webhookPayload: any): Promise<{ success: boolean; messageId?: string; clientId?: string }> => {
  try {
    console.log('[WHATSAPP SERVICE] Parsing incoming webhook payload:', JSON.stringify(webhookPayload));
    
    let incomingPhone = '';
    let messageText = '';
    let instanceId = 'comercial';
    let messageId = '';
    
    // 1. Parse Evolution API Webhook Structure (standard or v2)
    if (webhookPayload.event === 'messages.upsert' || webhookPayload.data?.key) {
      const data = webhookPayload.data;
      messageId = data.key?.id || '';
      instanceId = webhookPayload.instance || 'comercial';
      
      // Extract remote JID (e.g. "351912345678@s.whatsapp.net")
      const remoteJid = data.key?.remoteJid || '';
      incomingPhone = remoteJid.split('@')[0];
      
      // Determine message content from various possible locations in Baileys format
      const messageObj = data.message;
      if (messageObj) {
        messageText = messageObj.conversation || 
                      messageObj.extendedTextMessage?.text || 
                      messageObj.imageMessage?.caption || 
                      '';
      }
    } 
    // 2. Fallback: Parse generic Meta Cloud API Payload
    else if (webhookPayload.object === 'whatsapp_business_account') {
      const entry = webhookPayload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];
      
      if (message) {
        messageId = message.id;
        incomingPhone = message.from; // Sender phone number
        messageText = message.text?.body || '';
        instanceId = value?.metadata?.phone_number_id || 'official_meta';
      }
    }
    // 3. Simple payload fallback for testing or manual triggers
    else {
      incomingPhone = webhookPayload.phone || '';
      messageText = webhookPayload.text || '';
      instanceId = webhookPayload.instanceId || 'comercial';
      messageId = webhookPayload.id || `msg_${Date.now()}`;
    }

    if (!incomingPhone) {
      console.warn('[WHATSAPP SERVICE] Webhook rejected: Phone number not found in payload.');
      return { success: false };
    }

    // Locate the matching client
    const client = await findClientByPhone(incomingPhone);
    if (!client) {
      console.warn(`[WHATSAPP SERVICE] Incoming message from ${incomingPhone} could not be matched with any CRM client.`);
      return { success: false };
    }

    console.log(`[WHATSAPP SERVICE] Match found! Storing message for client: ${client.name} (ID: ${client.id})`);

    // Prepare normalized message document
    const messageDoc: Omit<WhatsAppMessage, 'id'> = {
      sender: 'client',
      text: messageText || '[Média ou Mensagem não suportada]',
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      createdAt: serverTimestamp(),
      isAutomatic: false,
      instanceId
    };

    // Store in firestore under clients/{clientId}/whatsapp_messages
    const messagesCollectionRef = collection(db, 'clients', client.id, 'whatsapp_messages');
    const docRef = await addDoc(messagesCollectionRef, messageDoc);
    
    // Update the last interaction timestamp on the client for smart sorting
    const clientRef = doc(db, 'clients', client.id);
    await updateDoc(clientRef, {
      lastInteraction: new Date().toISOString()
    });

    return { 
      success: true, 
      messageId: docRef.id, 
      clientId: client.id 
    };

  } catch (error) {
    console.error('[WHATSAPP SERVICE] Failed to process incoming webhook:', error);
    return { success: false };
  }
};
