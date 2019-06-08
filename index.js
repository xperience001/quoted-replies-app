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
    track: '@quotedreplies please'
  }
);

stream.on('data', function(tweet) {
  if (isValidMention(tweet)) {
    var status = prepareStatus(tweet);
    sendToApi(tweet.id_str);
    sendStatus(status, tweet.id_str);
  } else {
    console.log('this is a retweet, not a mention; or it is a mention to ignore.');
    console.log(tweet.text);
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

  axios.post(`${process.env.apiUrl}/tweet`, data)
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
  var index = Math.floor(Math.random() * startWords.length);
  var startWord = startWords[index];
  var staticUrlPartType1 = 'https://twitter.com/search?f=tweets&vertical=default&q=twitter.com';
  var staticUrlPartType2 = 'https://twitter.com/search?f=tweets&vertical=default&q=https://twitter.com';
  var usernameString = `@${tweet.user.screen_name} ${startWord}! These are the links to the quoted replies you asked for!`;
  var dynamicUrlPart = `${tweet.in_reply_to_screen_name}/status/${tweet.in_reply_to_status_id_str}`;
  var searchLinkType1 = `${staticUrlPartType1}/${dynamicUrlPart}`;
  var searchLinkType2 = `${staticUrlPartType2}/${dynamicUrlPart}`;
  var status = `${usernameString} \n${searchLinkType1} \n${searchLinkType2} \n✨😊`;

  return status;
}

function isValidMention(tweet) {
  if (tweet && tweet.text) {
    var text = tweet.text;
    text = text.replace(/@\w+/g, '').trim();

    if (tweet.in_reply_to_status_id_str
      && tweet.in_reply_to_screen_name
      && text.length < 10) {
      return true;
    }
  }

  return false;
}
