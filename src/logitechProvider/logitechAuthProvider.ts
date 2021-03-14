import { User } from "../models/user";
import fetch from "node-fetch";

export class LogitechAuthProvider {
    private session:string;
    private user:User;

    private async authorize(user:User):Promise<string> 
    {
        let authResponse = await fetch('https://video.logi.com/api/accounts/authorization', {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Origin': 'https://circle.logi.com'
            },
            body: JSON.stringify(user)
        });
    
        let cookie:string = authResponse.headers.get('set-cookie');
        let sessionCookie = cookie.match(/prod_session=[^;]+/)[0];
        return sessionCookie;
    };

    public async GetSessionCookie(user:User) {
        if(!this.session || user.email != this.user.email) {
            this.session = await this.authorize(user);
            this.user = user;
        }

        return this.session;
    }
}