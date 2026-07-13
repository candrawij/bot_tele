import axios from 'axios';
import { config } from '../config.js';

export async function sendToHermesAgent(prompt: string) {
  const response = await axios.post(
    `${config.hermesAgentUrl}/api/chat`,
    {
      model: config.hermesAgentModel,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        ...(config.hermesAgentApiKey
          ? { Authorization: `Bearer ${config.hermesAgentApiKey}` }
          : {}),
      },
      timeout: 30000,
    },
  );

  return response.data;
}
