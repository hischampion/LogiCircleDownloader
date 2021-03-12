import { Stream } from "node:stream";
import { Accessory } from "./models/accessory";
import { Activity } from "./models/activity";
import { DownloadedFile } from "./models/downloadedfile";
import { Settings } from "./models/settings";
import { User } from "./models/user";

const debug = require('debug')('dsd');
const fs = require('fs');
const fetch = require('node-fetch');
const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')
const path = require('path');
const settings:Settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));

const authorize = async (user:User):Promise<string> => {
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

const get_accessories = async (sessionCookie:string):Promise<Array<Accessory>> => {
    return await fetch('https://video.logi.com/api/accessories', {
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'Origin': 'https://circle.logi.com'
        }
    })
    .then(response => response.json());
};

const get_activities = async (accessory, sessionCookie:string):Promise<Array<Activity>> => {
    let activitiesList = new Array<Activity>();
    let activitiesResponse = { nextStartTime: null, activities: new Array<Activity>() };

    do {
        activitiesResponse = await fetch(`https://video.logi.com/api/accessories/${accessory.accessoryId}/activities`, 
        {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Cookie': sessionCookie,
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
        }).then(response => response.json());

        activitiesList.push(...activitiesResponse.activities);
    }
    while(activitiesResponse.nextStartTime)

    return activitiesList;
};

const download_activity = async(accessory, activity, sessionCookie:string):Promise<DownloadedFile> => {
    let url = `https://video.logi.com/api/accessories/${accessory.accessoryId}/activities/${activity.activityId}/mp4`;
    debug(`downloading ${url}`);

    return await fetch(url, {
        headers: {
            'Cookie': sessionCookie,
            'Origin': 'https://circle.logi.com'
        }
    }).then(response => {
        let contentDisposition = response.headers.get('content-disposition');
        let filename = contentDisposition.match(/filename=([^;]+)/)[1];
        return { filename, stream: response.body };
    });
};

const save_stream = async(filepath:string, stream:Stream) => {
    stream.pipe(fs.createWriteStream(filepath)).on('close', () => {
        debug('saved', filepath);
    });
};

const run = async() => {
    const user:User = {
        email: process.env.LOGI_EMAIL,
        password: process.env.LOGI_PASS
    };

    const download_directory = process.env.DOWNLOAD_DIRECTORY;
    const db = await low(new FileAsync('db.json'));

    await db.defaults({ downloadedActivities: [] }).write()

    let sessionCookie = await authorize(user);

    let accessories = await get_accessories(sessionCookie);

    for(var accessory of accessories) {

        if(settings.devices.length > 0 && !(settings.devices.includes(accessory.accessoryId))) {

            debug('Skipping accessory ', accessory.accessoryId);

        } else {

            let activities = await get_activities(accessory, sessionCookie);
        
            for(var activity of activities) {
    
                let found = db.get('downloadedActivities').indexOf(activity.activityId) > -1;
    
                if(!found && activity.relevanceLevel >= settings.relevanceThreshold) {

                    let download:DownloadedFile = await download_activity(accessory, activity, sessionCookie);

                    let dir = download_directory;

                    if(settings.dateFolders){
                        let activityDate = new Date(activity.startTime);
                        let date = activityDate.getFullYear() + '-' + (activityDate.getMonth() + 1 ) + '-' + activityDate.getDate();
        
                        if (!fs.existsSync(path.join(download_directory, date))) {
                            fs.mkdirSync(path.join(download_directory, date));
                        }

                        dir = path.join(download_directory, date);
                    }

                    if(settings.deviceFolders){
                        let pathWithDevice = path.join(dir, accessory.name);

                        if (!fs.existsSync(pathWithDevice)) {
                            fs.mkdirSync(path.join(pathWithDevice));
                        }

                        dir = pathWithDevice;
                    }

                    let filepath = path.join(dir, download.filename);
                    
                    save_stream(filepath, download.stream);
                    db.get('downloadedActivities').push(activity.activityId).write();
    
                }
                
            }
    
        }

    }
    
};

run()
