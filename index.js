const dotenv = require('dotenv');
dotenv.config();

const colors = require('colors');

const fetch = require('node-fetch');

const tmi = require('tmi.js');

const twitchclient = new tmi.Client({
    options: {
        debug: true
    },
    identity: {
        username: process.env.twitchusername,
        password: process.env.twitchoauth
    },
    channels: [process.env.twitchchannels]
});

twitchclient.connect().catch('twitch client error: '+console.error);

const Discord = require('discord.js');
const {
    MessageEmbed
} = require('discord.js');
const client = new Discord.Client({
    intents: 36727
});

const games = require('./games');

var isStreaming = false;
var cooldown = false;
var cooldownTimeout;

const cooldownTime = 1000 * 60 * 60 * 2; // 2 hours
const testConnectionCooldownTime = 3000; // 3 secounds
const sessionKeyTest = 1000 * 60 * 60; // 1 hour


console.log('Actual Cookies:'.cyan, process.env.cookies.yellow);
console.log('session_key expire date:'.cyan, process.env.cookiedate.yellow);

// When the discord bot is ready.
client.on('ready', () => {
    console.log(`Discord BOT Logged in as ${client.user.tag}!`);

    // get the notifications channel of our discord server
    const channel = client.channels.cache.find(channel => channel.id === process.env.discordchannel);

    // Checks if "session_key" cookie is still valid
    setInterval(function () {
        // We use the v3 API of booyah for checking the stream status, but in this case is used for checking if
        // "session_key" cookie is still valid.
        // The responses may be "4030" if the session cookie is invalid or "404" if the streamer is offline.
        fetch(`https://booyah.live/api/v3/channels/${process.env.userID}/streams`, {
                'headers': {
                    'accept': '*/*',
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'cookie': process.env.cookies,
                },
                'method': 'GET',
            }).then(res => res.json())
            .then(data => {
                if (data.code === 4030) {
                    console.log("The session key has expired, sending mail, discord private message and twitch whisper".red);
                    client.users.cache.get(process.env.discorddm).send('The session key has expired')
                    twitchclient.whisper(process.env.twitchdm, "The session key has expired")
                        .then(function (data) {
                            console.log('The twitch whisper has been sended', data);
                        }).catch(function (err) {
                            console.log('The twitch whisper failed to send: ', err);
                        });
                } else if (data.code === 404) {
                    console.log("The session key is still valid".green);
                }
            });
    }, sessionKeyTest);


    // Test every "testConnectionCooldownTime" ms if the streamer if onfline or offline
    setInterval(function () {
        // We use the v3 API of booyah for checking the stream status
        fetch(`https://booyah.live/api/v3/channels/${process.env.userID}/streams`, {
                'headers': {
                    'accept': '*/*',
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'cookie': process.env.cookies,
                },
                'method': 'GET',
            }).then(res => res.json())
            .then(data => {
                if (data.code === 4030) {
                    console.log("The session key has expired or it is invalid".red);
                }

                console.log('-----------------------'.random);
                console.log('Request sent'.green);
                console.log('Is streaming?: ', isStreaming);
                console.log('Cooldown status: ', cooldown);
                console.log('Viewer count:', data.viewer_count, typeof data.viewer_count);

                

                const discordNotificationEmbed = new MessageEmbed()
                    .setColor('#ffff00')
                    .setTitle(process.env.embedtitle)
                    .setURL(`https://booyah.live/channels/${process.env.userID}`)
                    .setAuthor(process.env.channelname, process.env.channellogo, `https://booyah.live/channels/${process.env.userID}`)
                    .setDescription(process.env.embeddescription)
                    .setThumbnail(process.env.embedthumbnail)
                    .addFields({
                            name: 'Game',
                            value: `Just Chatting`,
                            inline: true
                        }, // game
                        {
                            name: 'Spectators',
                            value: `${data.viewer_count}`,
                            inline: true
                        }, // viewers
                    )
                    .setImage(data.snapshot_webp)
                    .setTimestamp()
                    .setFooter(process.env.botname, process.env.botlogo);

                // If the stream is online
                if (typeof data.viewer_count === 'number' && !isStreaming) {
                    isStreaming = true;
                    cooldown = true;

                    // Send Notification
                    console.log('The stream is on'.green);
                    channel.send({
                        content: process.env.discordmessage,
                        embeds: [discordNotificationEmbed]
                    });

                    twitchclient.say(process.env.twitchchannel, `${process.env.twitchmessage}, https://booyah.live/channels/${process.env.userID}`) // CABROS EL CRISTIAN PRENDIO EN BOOYAH! VAYAN A VERLO CTM!
                        .then((data) => {
                            console.log("The twitch notifications was sent.");
                        }).catch((err) => {
                            console.log("The twitch notification failed: ", err);
                        });

                    // We clear the cooldown if it is runing, and start a new cooldown
                    clearTimeout(cooldownTimeout);

                    cooldownTimeout = setTimeout(() => {
                        console.log('Cooldown ended, waiting for the next stream'.yellow);
                        cooldown = false;
                    }, cooldownTime)

                    // If the streamer is offline
                } else if (typeof data.viewer_count === "undefined" && !cooldown) {
                    isStreaming = false;
                    console.log("The streamer isn't streaming".red, `\n`);
                }

            });
    }, testConnectionCooldownTime);

});

client.login(process.env.discordbottoken);
