const core = require('@actions/core');

const jsdom = require("jsdom");
const { WebhookClient } = require('discord.js');

async function fetchNewPostAndUpdate() {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

    const proxy = 'https://cors-anywhere.argavyon.workers.dev/?';
    const forumURL = 'https://forums.ddo.com/index.php?forums/ddo-store-sales-and-promotions.8';

    const response1 = await fetch(proxy + forumURL);
    const html1 = await response1.text();

    // Convert the HTML string into a document object
    const dom1 = new jsdom.JSDOM(html1);

    const firstThread = dom1.window.document.querySelector('.js-threadList').firstElementChild.querySelector('.structItem-title');
    const threadHRef = firstThread.querySelector('a').href;
    const lastURL = core.getInput('post_url');
    
    console.log(`Last Post URL: ${lastURL}`);
    console.log(`This Post URL: ${threadHRef}`);

    if (threadHRef === lastURL) {
        core.warning('No new posts found');
        core.setOutput('new_post', 0);
    } else {
        core.setOutput('new_post', 1);
        core.setOutput('post_url', threadHRef);

        const response2 = await fetch(proxy + 'https://forums.ddo.com' + threadHRef);
        const html2 = await response2.text();

        // Convert the HTML string into a document object
        const dom2 = new jsdom.JSDOM(html2);

        const title = dom2.window.document.querySelector('h1').textContent;
        const postWrapper = dom2.window.document.querySelector('article.message--post').querySelector('.bbWrapper');
        const postWrapperInnerDiv = postWrapper.querySelector('div');
        const post = (postWrapperInnerDiv ?? postWrapper).innerHTML.replace(/<\/?b>/g, '**').replace(/<br>/g, '');
        
        console.log(`Title: ${title}`);
        console.log('Post Body:', post);

        const webhookStringData = core.getInput('webhook_string_data');
        const webhookClients = webhookStringData // Each line of the secret contains a server ID and a webhook token, separated by a space
            .split(/\r?\n/)
            .filter(line => line !== '')
            .map(line => {
                [id, token] = line.split(' ');
                return new WebhookClient({id: id, token: token});
            })
        ;

        webhookClients.forEach(
            client => client.send({
                content: 'https://forums.ddo.com' + threadHRef,
                username: 'DDO Marketplace Update Tracker',
                avatarURL: 'https://i.imgur.com/rJrjYku.png',
                embeds: [{
                    title: title,
                    color: 0x0099ff,
                    description: post,
                }],
            })
        );
    }
}

try {
    fetchNewPostAndUpdate();
} catch (error) {
    core.setFailed([error.toString(), error.stack].join('\n'));
}
