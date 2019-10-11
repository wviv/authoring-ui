'use strict';

angular.module('singleConceptAuthoringApp')
  .controller('batchCtrl', function ($scope, $rootScope, $modalInstance, scaService, metadataService, $location) {
    
    $scope.projects = null;

    function initialize() {
      $scope.projects = metadataService.getProjects();
    }
    
    $scope.close = function () {
      $modalInstance.close();
    };
    initialize();
  });
