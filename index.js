const {
    conversation,
    Card,
    Collection,
    Simple,
    List,
    Media,
    Image,
    Table,
  } = require('@assistant/conversation');
  const functions = require('firebase-functions');
  const axios = require('axios');
  const api_key = <YOU_API_KEY>;
  
  const app = conversation({debug: true});
  
  const ASSISTANT_LOGO_IMAGE = new Image({
    url: 'https://developers.google.com/assistant/assistant_96.png',
    alt: 'Google Assistant logo',
  });
  
  // save home station in user storage
  app.handle('save_home_in_storage', (conv) => {
    let home = conv.session.params.homeStationName;
    conv.user.params.homeStorage = home;
    });
  
  // pull home from storage to session
  app.handle('pull_home', (conv) => {
    conv.session.params.home = conv.user.params.homeStorage;
      });

  // clear previously stored home station
  app.handle('clear_home', (conv) => {
    conv.user.params.homeStorage = null;
    //convo.add("ok, home deleted!");
      });
  
  // check if user has already save home station
  app.handle('check_if_home_stored', (conv) => {
    if (conv.user.params.homeStorage){
      conv.session.params.existed = "True";
    }
    else{
      conv.session.params.existed = "False";
    }
  });
  
  app.handle('callMetroAPI', async(conv)  =>{
      let homeStation = conv.session.params.starting_station;
      let destinationStation =  conv.session.params.destination;
      const responseForStations = await axios.get(`https://api.wmata.com/Rail.svc/json/jStations`, {headers: {"api_key": api_key}});
      let stations = responseForStations.data.Stations;
      let homeStationCode;
      let userDestinationCode;
      let speakoutput;
        
      const getStationCode = (stationName) => {
        for (let i = 0; i < stations.length; i++){
            if (stations[i].Name.toLowerCase() === stationName){
                let StationCode = stations[i].Code;
                return StationCode;
            }
        }
        return null;
      };
      
      homeStationCode = getStationCode(homeStation.toLowerCase());
      userDestinationCode = getStationCode(destinationStation.toLowerCase());
      
      if (!(homeStationCode === null || userDestinationCode === null)){
          let response = await axios.get(`https://api.wmata.com/StationPrediction.svc/json/GetPrediction/${homeStationCode}`, {headers: {"api_key": api_key}});
          let found;
          let endPointCode;
          // Check to ensure there is a 'response' object
          if (response && response.data) {
                //set default response
              speakoutput = `there is no train that goes directly from ${homeStation} to ${destinationStation}.`;
              //check if the direction is valid
              let trainPredictions = response.data.Trains;
              for (let i = 0; i <trainPredictions.length; i++){
                  let prediction = trainPredictions[i];
                    //check if the endpoint is already checked
                  if (prediction.DestinationCode === endPointCode){
                      continue;    
                  }
                  else{
                      endPointCode = prediction.DestinationCode;
                      let response2 = await axios.get(`https://api.wmata.com/Rail.svc/json/jPath?FromStationCode=${homeStationCode}&ToStationCode=${endPointCode}`,{headers: {"api_key": api_key}});
                      if (response2 && response2.data){
                          let path = response2.data.Path;
                          for(let i = 1; i < path.length; i++){
                              if (path[i].StationCode === userDestinationCode){
                                  let minutes = prediction.Min;
                                  if (minutes === "ARR") {
                                      speakoutput = ` the train is arriving now.`;
                                  }
                                  else if (minutes === "BRD" ){
                                      speakoutput = `the train is boarding passengers now.`;
                                  }
                                  else{
                                      speakoutput = `the next train to ${destinationStation} will arrive at ${homeStation} in ${minutes} minutes.`;
                                  }
                                  found = true;
                                  break;
                              }
                          }                        
                      }
                      else{
                          speakoutput = `An error has occurred while retrieving the requried information.`;
                      }
                  }
                  if (found === true) {
                      break;
                  }
              }
          }
          else {
              speakoutput = `An error has occurred while retrieving the position information.`;
          }            
      }
      else{
          speakoutput = "Sorry, at least one of the stations you mentioned is not valid.";
      }
      conv.user.params.MetroPrediction = speakoutput;
    
    });
  exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
