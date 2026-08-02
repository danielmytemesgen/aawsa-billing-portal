import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const key = new TextEncoder().encode(env.SESSION_SECRET);

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(key);
}

export async function decrypt(token: string): Promise<any> {
    const { payload } = await jwtVerify(token, key, {
        algorithms: ["HS256"],
    });
    return payload;
}
