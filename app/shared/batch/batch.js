'use strict';

angular.module('singleConceptAuthoringApp')
  .controller('batchCtrl', function ($scope, $rootScope, $modalInstance, scaService, metadataService, $location) {
    
    $scope.projects = null;
    $scope.users = null;

    function initialize() {
      var users = [];

      function getUsers(start, end) {
        var expand =  'users[' + start + ':' + end + ']';
        scaService.getUsers(expand).then(function (response) {
          if (response.users.items.length > 0) {
            angular.forEach(response.users.items, function (item) {
              if (item.key !== $rootScope.accountDetails.login) {
                var user = {};
                user.avatarUrl = item.avatarUrls['16x16'];
                user.displayName = item.displayName;
                user.email = item.emailAddress;
                user.username = item.key;
                users.push(user);
              }
            });
            $scope.users = users;
          }

          if (response.users.size > end) {
            getUsers(start + 50, end + 50);
          }
        },
        function (error) {});
      }
        
      getUsers(0,50);
    
      $scope.projects = metadataService.getProjects();
    }
    
    $scope.getAvailableUsers = function(exceptList) {
        if ($scope.users.length === 0) {
          return [];
        }
        return $scope.users;
      };
    
    $scope.close = function () {
      $modalInstance.close();
    };
    initialize();
  });
