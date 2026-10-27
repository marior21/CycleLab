import { safeStorage } from "electron";
import type { Store } from "./store";
export class Credentials {
  constructor(private store: Store) {}
  get(provider: "garmin" | "openrouter" | "maptiler") {
    const encrypted = this.store.secret(provider);
    if (!encrypted)
      throw new Error(
        `Configura la API key de ${provider === "garmin" ? "Garmin" : provider === "maptiler" ? "MapTiler" : "OpenRouter"} en Ajustes.`,
      );
    if (!safeStorage.isEncryptionAvailable())
      throw new Error("El llavero de macOS no está disponible.");
    return safeStorage.decryptString(encrypted);
  }
  save(provider: "garmin" | "openrouter" | "maptiler", key: string) {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error(
        "No se puede guardar la clave: el llavero no está disponible.",
      );
    this.store.saveSecret(provider, safeStorage.encryptString(key));
  }
}
