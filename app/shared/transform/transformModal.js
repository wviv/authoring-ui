angular.module('singleConceptAuthoringApp.transformModal', [])

  .controller('transformModalCtrl', function ($scope, $modalInstance, branch, results, templateFrom, templateService, metadataService) {

    $scope.branch = branch;
    $scope.results = results;
    $scope.templateFrom = templateFrom;
    $scope.templateTo = '';
    
    if(!metadataService.isTemplatesEnabled()){
        templateService.getTemplates().then(function (response) {
          for(let i = response.length -1; i <= 0; i--){
            console.log(response[i]);
              console.log(response[i].additionalSlots.length);
              if(response[i].additionalSlots.length > 0)
                {
                  response.splice(i, 1);
                }
          }
          $scope.templates = response;
        });
      }

    /////////////////////////////////////////
    // Modal control buttons
    /////////////////////////////////////////
    $scope.getTemplateSuggestions = function (text) {
            return $scope.templates.filter(template => template.name.toLowerCase().indexOf(text.toLowerCase()) > -1);
          };
    
    $scope.transform = function() {
      templateService.transform($scope.branch, $scope.templateFrom, $scope.templateTo, 'NONCOMFORMANCE_TO_EDITORIAL_POLICY', $scope.results).then(function(response){
          $modalInstance.close(response);
      });
    };

    $scope.cancel = function () {
      $modalInstance.dismiss();
    };
  });
