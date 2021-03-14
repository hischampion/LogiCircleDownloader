const debug = require('debug')('dsd');
import fetch from "node-fetch";
import { Accessory } from "../models/accessory";
import { Activity } from "../models/activity";
import { DownloadedFile } from "../models/downloadedfile";
import { User } from "../models/user";
import { LogitechAuthProvider } from "./logitechAuthProvider";

export class LogitechEventProvider {
    private authProvider = new LogitechAuthProvider();
    
    public async getAccessories(user:User):Promise<Array<Accessory>>
    {
        var response = await fetch('https://video.logi.com/api/accessories', {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Cookie': await this.authProvider.GetSessionCookie(user),
                'Origin': 'https://circle.logi.com'
            }
        });
        
        return await response.json();
    };
    
    public async getActivities(accessory:Accessory, user:User):Promise<Array<Activity>> 
    {
        let activitiesList = new Array<Activity>();
        let activitiesResponse = { nextStartTime: null, activities: new Array<Activity>() };
    
        do {
            var response = await fetch(`https://video.logi.com/api/accessories/${accessory.accessoryId}/activities`, 
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Cookie': await this.authProvider.GetSessionCookie(user),
                    'Origin': 'https://circle.logi.com'
                },
                body: JSON.stringify({
                    "extraFields": [
                        "activitySet"
                    ],
                    "operator": "<=",
                    "limit": 80,
                    "scanDirectionNewer": true,
                    "startActivityId": activitiesResponse.nextStartTime,
                })
            });

            activitiesResponse = await response.json();

            for(var activity of activitiesResponse.activities) {
                activity.startTime = new Date(activity.startTime);
            }
    
            activitiesList.push(...activitiesResponse.activities);
        }
        while(activitiesResponse.nextStartTime)
    
        return activitiesList;
    };
    
    public async downloadActivity(accessory:Accessory, activity:Activity, user:User):Promise<DownloadedFile> 
    {
        let url = `https://video.logi.com/api/accessories/${accessory.accessoryId}/activities/${activity.activityId}/mp4`;
        debug(`downloading ${url}`);
    
        var response = await fetch(url, {
            headers: {
                'Cookie': await this.authProvider.GetSessionCookie(user),
                'Origin': 'https://circle.logi.com'
            }
        });
        
        let contentDisposition = response.headers.get('content-disposition');
        let filename = contentDisposition.match(/filename=([^;]+)/)[1];
        return { filename, stream: response.body };
    };
}