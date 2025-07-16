// Note: Using 'export {}' to make this file a module
// if it doesn't import/export anything else, otherwise declare global is ignored.
export { };

declare global {
    namespace Express {
        export interface Request {
            user?: {
                id: string;
                email: string;
            };
        }
        export interface Locals {
            user?: {
                id: string;
                email: string;
            };
        }
    }
} 