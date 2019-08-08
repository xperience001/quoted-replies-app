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

  tweet.is_valid_extended_tweet = false;
  if (tweet.extended_tweet && tweet.extended_tweet.full_text && tweet.extended_tweet.full_text.toLowerCase().includes('quotedreplies')) {
    tweet.is_valid_extended_tweet = true;
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
  if (tweet.text && tweet.text.toLowerCase().includes('mention')
    || tweet.text.toLowerCase().includes('use')
    || tweet.text.toLowerCase().includes('try')
  ) {
    tweet.should_ignore = true;
    tweet.ignore_reason = `Tweet contains 'mention', 'use' or 'try'`;
    return tweet;
  }

  if (tweet.text) {
    console.log(`just text :: ${tweet.text}`);
  }

  if (tweet.extended_tweet && tweet.extended_tweet.full_text) {
    console.log(`full text :: ${tweet.extended_tweet.full_text}`);
  }

  // the text does not contain the bot's name
  if (tweet.extended_tweet && tweet.extended_tweet.full_text && !tweet.extended_tweet.full_text.toLowerCase().includes('quotedreplies')) {
    console.log(`to lower() for full text :: ${tweet.extended_tweet.full_text.toLowerCase()}`);
    console.log('quotedreplies');
    tweet.should_ignore = true;
    tweet.ignore_reason = 'Tweet does not contain the bot name';
    return tweet;
  }

  if (!tweet.is_valid_extended_tweet && tweet.text && !tweet.text.toLowerCase().includes('quotedreplies')) {
    console.log(`to lower() for text :: ${tweet.text.toLowerCase()}`);
    tweet.should_ignore = true;
    tweet.ignore_reason = 'Tweet does not contain the bot name';
    return tweet;
  }

  // ignore if tweet text without handles is too long
  if (tweet.text && isSuspiciousLength(tweet.text)) {
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
    console.log("just the quoted_status field of the tweet tweet");
    console.log(tweet.quoted_status);
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
  let startWords = ['Psst', 'Aye', 'Holla', 'Hey'];
  let tweetTexts = ['Follow this link to view the quoted replies you asked for!', 'Because you asked nicely...', 'Here you go!'];
  let startWordsIndex = Math.floor(Math.random() * startWords.length);
  let tweetTextsIndex = Math.floor(Math.random() * tweetTexts.length);
  let startWord = startWords[startWordsIndex];
  let tweetText = tweetTexts[tweetTextsIndex];
  let staticUrlPart = 'https://twitter.com/search?f=tweets&vertical=default&q=https://twitter.com';
  let usernameString = `@${tweet.user.screen_name}`;
  let dynamicUrlPart = getDynamicUrlPart(tweet);

  let searchLink = `${staticUrlPart}/${dynamicUrlPart}`;
  let status = `${usernameString}\n${searchLink}`;

  return status;
}

let isSuspiciousLength = (text) => {
  text = text.replace(/@\w+/g, '').trim();
  text = text.replace(/https:\/\/\w.\w+\/\w+/g, '').trim();
  if (text.length === 0 || (text.length < 7 && text.length > 2)) {
    if (text.toLowerCase().includes('please') || text.toLowerCase().includes('pls')) {
      return false;
    }
  }

  return true;
}
