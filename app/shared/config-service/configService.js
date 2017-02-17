'use strict';

angular.module('singleConceptAuthoringApp')
  .factory('configService', ['$http', '$q', function ($http, $q) {

    var properties = null;
    var validationProperties = null;
    var versions = null;

    function getConfigProperties() {
      var deferred = $q.defer();
      if (!properties) {
        $http.get('/config/endpointConfig.json').then(function (response) {
          properties = response.data;
          $http.get('/validationConfig/validationConfig.json').then(function (validationResponse) {
              $http.get('/config/versions.json').then(function (confResponse) {
                  versions = confResponse.data;
                  deferred.resolve(properties, validationProperties, versions);
                }, function(error) {
                  console.log(error);
                  deferred.reject('Failed to retrieve version configuration properties');
                });
            }, function() {
              deferred.reject('Failed to retrieve validation configuration properties');
            });

        }, function() {
          deferred.reject('Failed to retrieve configuration properties');
        });
      } else {
        deferred.resolve(properties, validationProperties);
      }
      return deferred.promise;
    }

    return {
      getEndpoints: function () {
        var deferred = $q.defer();
        getConfigProperties().then(function() {
          deferred.resolve(properties.endpoints);
        }, function(error) {
          deferred.reject(error);
        });
        return deferred.promise;
      },
      getVersions: function () {
        var deferred = $q.defer();
        getConfigProperties().then(function() {
            console.log(versions)
          deferred.resolve(versions.versions);
        }, function(error) {
          deferred.reject(error);
        });
        return deferred.promise;
      },

      getExcludedValidationRuleIds : function() {
        var deferred = $q.defer();
        getConfigProperties().then(function() {
          deferred.resolve(validationProperties.excludedRuleIds);
        }, function(error) {
           deferred.reject(error);

        });
        return deferred.promise;
      },

      getWhiteListEligibleRuleIds : function() {
        var deferred = $q.defer();
        getConfigProperties().then(function() {
         deferred.resolve(validationProperties.whitelistEligibleIds);
        }, function(error) {
          deferred.reject(error);
        });
        return deferred.promise;
      }
    };
  }]);
