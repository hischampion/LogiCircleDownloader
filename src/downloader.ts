import { Stream } from "node:stream";
import { LogitechEventProvider } from "./logitechProvider/logitechEventProvider";
import { Accessory } from "./models/accessory";
import { Activity } from "./models/activity";
import { DownloadedFile } from "./models/downloadedfile";
import { Settings } from "./models/settings";
import { User } from "./models/user";

const debug = require('debug')('dsd');
const fs = require('fs');
const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')
const path = require('path');
const settings:Settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
const logitechEventProvider = new LogitechEventProvider();

run();

async function run() 
{
    const user:User = {
        email: process.env.LOGI_EMAIL,
        password: process.env.LOGI_PASS
    };

    const downloadsDirectory = process.env.DOWNLOAD_DIRECTORY;
    const db = await low(new FileAsync('db.json'));

    await db.defaults({ downloadedActivities: [] }).write();

    let accessories = await logitechEventProvider.getAccessories(user);

    for(var accessory of accessories) {
        if(settings.devices.length > 0 && !(settings.devices.includes(accessory.accessoryId))) {
            debug('Skipping accessory ', accessory.accessoryId);
        } else {
            let activities = await logitechEventProvider.getActivities(accessory, user);
        
            for(var activity of activities) {   
                let found = db.get('downloadedActivities').find({id: activity.activityId}).value();
    
                if(!found && activity.relevanceLevel >= settings.relevanceThreshold) {
                    let download:DownloadedFile = await logitechEventProvider.downloadActivity(accessory, activity, user);

                    await SaveFile(downloadsDirectory, activity, accessory, download);

                    db.get('downloadedActivities').push({id: activity.activityId}).write();
                }   
            }
        }
    }   
}

async function SaveFile(
    download_directory: string, 
    activity: Activity, 
    accessory: Accessory, 
    download: DownloadedFile):Promise<void> {

    let dir = download_directory;

    if (settings.dateFolders) {
        let date = activity.startTime.getFullYear() + '-' + (activity.startTime.getMonth() + 1) + '-' + activity.startTime.getDate();

        if (!fs.existsSync(path.join(download_directory, date))) {
            fs.mkdirSync(path.join(download_directory, date));
        }

        dir = path.join(download_directory, date);
    }

    if (settings.deviceFolders) {
        let pathWithDevice = path.join(dir, accessory.name);

        if (!fs.existsSync(pathWithDevice)) {
            fs.mkdirSync(path.join(pathWithDevice));
        }

        dir = pathWithDevice;
    }

    let filepath = path.join(dir, download.filename);

    await saveStream(filepath, download.stream);
}


async function saveStream(filepath:string, stream:Stream):Promise<void>
{
    await stream.pipe(fs.createWriteStream(filepath));
    debug('saved', filepath);
}