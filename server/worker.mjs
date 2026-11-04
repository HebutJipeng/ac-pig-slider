import { handleApi, snapshot } from './api.mjs';
export default {
 async fetch(request, env) { return handleApi(request, env); },
 async scheduled(event, env) { await snapshot(env.DB, event.scheduledTime); },
};
