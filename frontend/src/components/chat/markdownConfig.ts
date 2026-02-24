import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

// Shared markdown pipeline for both streaming and persisted messages.
export const SHARED_REMARK_PLUGINS = [remarkGfm, remarkBreaks] as const;

