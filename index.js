require('dotenv').config();
let Twitter = require('twitter');
let options = {
  consumer_key: process.env.consumer_key,
  consumer_secret: process.env.consumer_secret,
  access_token_key: process.env.access_token_key,
  access_token_secret: process.env.access_token_secret
};
let axios = require('axios');

let client = new Twitter(options);
let stream = client.stream(
  'statuses/filter',
  {
    track: '@quotedreplies'
  }
);

let addValidityInfoToTweet = (tweet) => {
  // re-assign tweet.text if this is an extended tweet... 
  // ...rather than do different checks along the way for both tweet.text and tweet.extended_tweet.full_text
  if (tweet.extended_tweet && tweet.extended_tweet.full_text) {
    tweet.text = tweet.extended_tweet.full_text;
  }

  if (!tweet.text) {
    tweet.should_ignore = true;
    tweet.ignore_reason = 'Tweet text is empty';
    return tweet;
  }

  // ignore if it's a retweet
  if (tweet.retweet_count > 0) {
    tweet.should_ignore = true;
    tweet.ignore_reason = 'Tweet is a retweet';
    return tweet;
  }

  // ignore if the tweet is in reply to quotedreplies
  if (tweet.in_reply_to_screen_name === 'QuotedReplies' && !tweet.is_quote_status) {
    tweet.should_ignore = true;
    tweet.ignore_reason = 'Tweet is a reply to QuotedReplies';
    return tweet;
  }

  // ignore if it contains 'mention/use'
  let textWithoutHandles = tweet.text.replace(/@\w+/g, '').trim();

  if (textWithoutHandles && textWithoutHandles.toLowerCase().includes('mention')
    || textWithoutHandles.toLowerCase().includes('use')
    || textWithoutHandles.toLowerCase().includes('try')
  ) {
    tweet.should_ignore = true;
    tweet.ignore_reason = `Tweet contains 'mention', 'use' or 'try'`;
    return tweet;
  }

  if (!tweet.text.toLowerCase().includes('quotedreplies')) {
    tweet.should_ignore = true;
    tweet.ignore_reason = 'Tweet does not contain the bot name';
    return tweet;
  }

  // ignore if tweet text without handles is too long
  if (isSuspiciousLength(tweet.text)) {
    tweet.should_ignore = true;
    tweet.ignore_reason = 'Tweet text length is suspicious';
    return tweet;
  }

  tweet.should_ignore = false;
  tweet.ignore_reason = null;
  return tweet;
}

let getDynamicUrlPart = (tweet) => {
  if (tweet.is_quote_status) {
    return `${tweet.quoted_status.user.screen_name}/status/${tweet.quoted_status.id_str}`;
  }

  // if it's not a quote
  return `${tweet.in_reply_to_screen_name}/status/${tweet.in_reply_to_status_id_str}`;
}

stream.on('data', (tweet) => {
  tweet = addValidityInfoToTweet(tweet);

  if (!tweet.should_ignore) {
    let status = prepareStatus(tweet);
    console.log("SENDING REPLY FOR VALID MENTION");
    console.log(tweet.text);
    console.log(tweet);
    // sendToApi(`https://twitter.com/${getDynamicUrlPart(tweet)}`);
    sendStatus(status, tweet.id_str);
  } else {
    console.log(`IGNORING TWEET BECAUSE :: ${tweet.ignore_reason} :: ${tweet.text}`);
    console.log(tweet);
  }
});

stream.on('error', (error) => {
  throw error;
});

let sendStatus = (status, id) => {
  client.post('statuses/update',
    {
      status: status,
      in_reply_to_status_id: id
    }, (err, data) => {
      if (err) {
        throw error;
      }
  });
}

let sendToApi = (tweetIdStr) => {
  let data = {
    tweet_id_str: tweetIdStr
  };

  axios.post(`${process.env.api_url}/tweet`, data)
  .then((res) => {
    console.log(`statusCode: ${res.status}`)
    console.log(res.config);
  })
  .catch((error) => {
    console.error(error)
  })
}

let prepareStatus = (tweet) => {
  let specialUsers = ['', ''];
  let tweetTexts = [`Because you're super special 😁...`];
  let tweetTextsIndex = Math.floor(Math.random() * tweetTexts.length);
  let tweetText = tweetTexts[tweetTextsIndex];
  let staticUrlPart = 'https://twitter.com/search?f=tweets&vertical=default&q=https://twitter.com';
  let usernameString = `@${tweet.user.screen_name}`;
  let dynamicUrlPart = getDynamicUrlPart(tweet);

  if (specialUsers.includes(tweet.user.id_str)) {
    staticUrlPart = `${tweetText} ${staticUrlPart}`;
  }

  let searchLink = `${staticUrlPart}/${dynamicUrlPart}`;
  let status = `${usernameString}\n${searchLink}`;

  return status;
}

let isSuspiciousLength = (text) => {
  text = text.replace(/@\w+/g, '').trim();
  text = text.replace(/https:\/\/\w.\w+\/\w+/g, '').trim();
  if (text.length === 0 || (text.length < 7) && (text.toLowerCase().includes('please') || text.toLowerCase().includes('pls'))) {
    return false;
  }

  return true;
}
