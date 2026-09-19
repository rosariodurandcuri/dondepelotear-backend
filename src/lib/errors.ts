/**
 * ERRORES DE LA API
 * Lanza `throw new AppError(404, 'La cancha no existe.')` desde cualquier ruta y
 * el manejador global (src/app.ts) responde { error: "..." } con ese código HTTP.
 */
export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string) => new AppError(400, message);
export const unauthorized = (message = 'Inicia sesión para continuar.') => new AppError(401, message);
export const forbidden = (message = 'No tienes permiso para realizar esta acción.') => new AppError(403, message);
export const notFound = (message = 'No encontrado.') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);
