require('dotenv').config();
var Twitter = require('twitter');
var options = {
  consumer_key: process.env.consumer_key,
  consumer_secret: process.env.consumer_secret,
  access_token_key: process.env.access_token_key,
  access_token_secret: process.env.access_token_secret
};
var axios = require('axios');

var client = new Twitter(options);
var stream = client.stream(
  'statuses/filter',
  {
    track: '@quotedreplies'
  }
);

let addValidityInfoToTweet = (tweet) => {
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

  // the text does not contain the bot's name
  if (tweet.text && !tweet.text.toLowerCase().includes('quotedreplies')) {
    tweet.should_ignore = true;
    tweet.ignore_reason = 'Tweet does not contain the bot name';
    return tweet;
  }

  // ignore if tweet text without handles is too long
  if (tweet.text && isTooLong(tweet.text)) {
    tweet.should_ignore = true;
    tweet.ignore_reason = 'Tweet text is too long';
    return tweet;
  }

  tweet.should_ignore = false;
  tweet.ignore_reason = null;
  return tweet;
}

let getDynamicUrlPart = (tweet) => {
  if (tweet.is_quote_status) {
    console.log(tweet.quoted_status);
    return `${tweet.quoted_status.user.screen_name}/status/${tweet.quoted_status.quoted_status_id_str}`;
  }

  // if it's not a quote
  return `${tweet.in_reply_to_screen_name}/status/${tweet.in_reply_to_status_id_str}`;
}

stream.on('data', function(tweet) {
  tweet = addValidityInfoToTweet(tweet);

  if (!tweet.should_ignore) {
    var status = prepareStatus(tweet);
    sendToApi(`https://twitter.com/${getDynamicUrlPart(tweet)}`);
    sendStatus(status, tweet.id_str);
  } else {
    console.log(`IGNORING TWEET BECAUSE :: ${tweet.ignore_reason}`);
    console.log(tweet);
  }
});

stream.on('error', function(error) {
  throw error;
});

function sendStatus(status, id) {
  client.post('statuses/update',
    {
      status: status,
      in_reply_to_status_id: id
    }, function (err, data) {
      if (err) {
        throw error;
      }
  });
}

function sendToApi(tweetIdStr) {
  var data = {
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

function prepareStatus(tweet) {
  var startWords = ['Psst', 'Aye', 'Holla', 'Hey'];
  var tweetTexts = ['Follow this link to view the quoted replies you asked for!', 'Because you asked nicely...', 'Here you go!'];
  var startWordsIndex = Math.floor(Math.random() * startWords.length);
  var tweetTextsIndex = Math.floor(Math.random() * tweetTexts.length);
  var startWord = startWords[startWordsIndex];
  var tweetText = tweetTexts[tweetTextsIndex];
  var staticUrlPart = 'https://twitter.com/search?f=tweets&vertical=default&q=https://twitter.com';
  var usernameString = `@${tweet.user.screen_name} ${startWord}! ${tweetText}`;
  let dynamicUrlPart = getDynamicUrlPart(tweet);

  var searchLink = `${staticUrlPart}/${dynamicUrlPart}`;
  var status = `${usernameString}\n${searchLink}\n✨😊`;

  return status;
}

let isTooLong = (text) => {
  text = text.replace(/@\w+/g, '').trim();
  if (text.length < 15) {
    return false;
  }

  return true;
}
