'use strict';

angular.module('singleConceptAuthoringApp')

  .directive('validation', ['$rootScope', '$filter', '$q', 'ngTableParams', '$routeParams', 'configService', 'validationService', 'scaService', 'terminologyServerService', 'notificationService', 'accountService', '$timeout', '$modal','metadataService', 'aagService',
    function ($rootScope, $filter, $q, NgTableParams, $routeParams, configService, validationService, scaService, terminologyServerService, notificationService, accountService, $timeout, $modal, metadataService, aagService) {
      return {
        restrict: 'A',
        transclude: false,
        replace: true,
        scope: {
          // validation container structure:
          // { report: [validation report], ...}
          validationContainer: '=',

          // flag for whether or not to allow editing controls
          editable: '&',

          // branch this report is good for
          branch: '=',

          // the task (optional)
          task: '=?',
            
          // date the branch was last promoted (optional)
          lastPromotion: '=?'
        },
        templateUrl: 'shared/validation/validation.html',

        link: function (scope, element, attrs, linkCtrl) {


          scope.editable = attrs.editable === 'true';
          scope.showTitle = attrs.showTitle === 'true';
          scope.displayStatus = '';
          scope.taskKey = $routeParams.taskKey;
          scope.isCollapsed = false;
          scope.autosaveEnabled = $routeParams.taskKey ? true : false;
          scope.allWhitelistItems = [];
          scope.viewFullListException = false;
          scope.exceptionLoading = false;

          // highlighting map
          scope.styles = {};


          scope.getSNF = function (id) {
            var deferred = $q.defer();
            terminologyServerService.getConceptSNF(id, scope.branch).then(function (response) {
              deferred.resolve(response);
            });
            return deferred.promise;
          };

          scope.conceptUpdateFunction = function (project, task, concept) {
            var deferred = $q.defer();
            terminologyServerService.updateConcept(project, task, concept).then(function (response) {
              deferred.resolve(response);
            });
            return deferred.promise;
          };
          // instantiate validation container if not supplied
          if (!scope.validationContainer) {
            scope.validationContainer = {executionStatus: '', report: ''};
          }

          // the rules to exclude


          // local variables for ng-table population
          scope.assertionsFailed = [];
          scope.failures = [];

          // Allow broadcasting of new validation results
          // e.g. from server-side notification of work complete
          scope.$on('setValidation', function (event, data) {
            scope.validationContainer = data.validation;

          });

          // function to get formatted summary text
          scope.getStatusText = function () {

            // check required elements
            if (!scope.validationContainer) {
              return;
            }
            if (!scope.validationContainer.executionStatus || scope.validationContainer.executionStatus === '') {
              return;
            }

            // get the human-readable execution status
            var status = scope.validationContainer.executionStatus.toLowerCase().replace(/\w\S*/g, function (txt) {
              return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });

            if (status && status === 'Stale') {
              return status;
            }

            if (scope.validationContainer.report && scope.validationContainer.report.rvfValidationResult) {

              // get the end time if specified
              if (scope.validationContainer.report.rvfValidationResult.endTime) {
                var endTime = scope.validationContainer.report.rvfValidationResult.endTime;
                return status + ' ' + covertToUTCTime(endTime);
              }

              if (scope.validationContainer.report.rvfValidationResult.startTime) {
                var startTime = scope.validationContainer.report.rvfValidationResult.startTime;
                return status + ', started ' + covertToUTCTime(startTime);
              }
            }

            return status;
          };
          
          function covertToUTCTime(dateTime) {
            if (!dateTime) {
              return;
            }
           
            var utcTime = new Date(dateTime + ' UTC');
            return $filter('date')(utcTime, "yyyy-MM-ddTHH:mm:ss'Z'","UTC");
          }

          scope.isProject = function(){
              if(scope.taskKey){
                  return false
              }
              else{return true}
          }

          // declare table parameters
          scope.failedAssertionsTableParams = new NgTableParams({
              page: 1,
              count: 10,
              sorting: {failureCount: 'desc'},
              orderBy: 'failureCount'
            },
            {
              filterDelay: 50,
              total: '-',
              getData: function ($defer, params) {

                if (!scope.assertionsFailed || scope.assertionsFailed.length === 0) {
                  params.total(0); // resolving empty array does not actually set total to 0
                  $defer.resolve([]);
                } else {

                  // cycle over each failed assertion to get count / display status
                  angular.forEach(scope.assertionsFailed, function (assertionFailed) {
                    if(assertionFailed.failureCount !== -1){
                        var filteredInstances = assertionFailed.firstNInstances.filter(function (instance) {

                          // if viewing task report and instance is not user modified, return false
                          if (!scope.viewFullReport && !instance.isBranchModification) {
                            return false;
                          }
                          // if validation failure is excluded, return false
                          if (validationService.isValidationFailureExcluded(assertionFailed.assertionUuid, instance.conceptId, instance.detail)) {
                            return false;
                          }

                          // otherwise return true
                          return true;
                        });
                        assertionFailed.filteredCount = filteredInstances.length;
                        assertionFailed.total = assertionFailed.failureCount;
                    }
                  });


                  // filter by user modification
                  var orderedData = scope.assertionsFailed.filter(function (assertionFailed) {
                    return assertionFailed.filteredCount > 0;
                  });

                  params.total(orderedData.length);
                  orderedData = params.sorting() ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;

                  $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                }
              }
            }
          );

          scope.warningAssertionsTableParams = new NgTableParams({
            page: 1,
            count: 10,
            sorting: {failureCount: 'desc'},
            orderBy: 'failureCount'
          },
          {
            filterDelay: 50,
            total: '-',
            getData: function ($defer, params) {

              if (!scope.assertionsWarning || scope.assertionsWarning.length === 0) {
                params.total(0);
                $defer.resolve([]);
              } else {

                // cycle over each failed assertion to get count / display status
                angular.forEach(scope.assertionsWarning, function (assertionWarning) {
                  if(assertionWarning.failureCount > 0){
                      var filteredInstances = assertionWarning.firstNInstances.filter(function (instance) {
                        // if viewing task report and instance is not user modified or validation failure is excluded, return false
                        if ((!scope.viewFullReport && !instance.isBranchModification) || instance.isUserExclusion) {
                          return false;
                        }                        

                        return true;
                      });
                      assertionWarning.filteredCount = filteredInstances.length;
                      assertionWarning.total = assertionWarning.failureCount;
                  }
                });

                // filter by user modification
                var orderedData = scope.assertionsWarning.filter(function (assertionWarning) {
                  return assertionWarning.filteredCount > 0;
                });

                params.total(orderedData.length);
                orderedData = params.sorting() ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;
                $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
              }
            }
          }
        );

          // sets view to top and clears viewed concept list
          scope.setViewTop = function () {
            scope.viewTop = true;
            scope.failedAssertionsTableParams.reload();
            scope.warningAssertionsTableParams.reload();
            scope.viewedConcepts = [];
          };

          // on load, set top vie
          scope.setViewTop();


          var conceptIds = [];

          function getConceptIdForFailure(failure) {
            var deferred = $q.defer();
            switch (String(failure.conceptId).substring(String(failure.conceptId).length - 2, String(failure.conceptId).length - 1)) {
              // concept: simply return
              case '0':
                conceptIds.push(failure.conceptId);
                deferred.resolve();
                break;
              // description: get description by id, replace with concept id
              case '1':
                terminologyServerService.getDescriptionProperties(failure.conceptId, scope.branch).then(function (desc) {
                  failure.conceptId = desc.conceptId;
                  conceptIds.push(desc.conceptId);
                  deferred.resolve();
                }, function (error) {
                  deferred.reject();
                });
                break;
              // relationship: get relationship by id, replace with source concept id
              case '2':
                terminologyServerService.getRelationshipProperties(failure.conceptId, scope.branch).then(function (rel) {
                  failure.relationshipId = rel.sourceId;
                  conceptIds.push(rel.sourceId);
                  deferred.resolve();
                }, function (error) {
                  deferred.reject();
                });
                break;
              default:
                console.error('Failure has unrecognized id type: ' + failure.conceptId);
                deferred.reject();
            }
            return deferred.promise;
          }

          //
          // Concept FSN and Description Term display names
          //

          scope.idNameMap = {};

          function getConceptNames(failures) {
            var deferred = $q.defer();
            var promises = [];
            conceptIds = [];
            angular.forEach(failures, function (failure) {
              promises.push(getConceptIdForFailure(failure));
            });

            angular.forEach(scope.failures, function (failure) {
              // switch on concept, relationship, or description
              promises.push(getConceptIdForFailure(failure));
            });

             $q.all(promises).then(function () {

               // skip if no concept ids
              if (conceptIds.length > 0) {

                // bulk call for concept ids
                terminologyServerService.bulkGetConceptUsingPOST(conceptIds, scope.branch).then(function (concepts) {
                  angular.forEach(concepts.items, function (concept) {
                    scope.idNameMap[concept.id] = concept.fsn.term;
                  });
                  angular.forEach(scope.failures, function (failure) {
                    failure.conceptFsn = scope.idNameMap[failure.conceptId];
                  });

                  deferred.resolve();
                });
              } else {
                deferred.resolve();
              }
            });

            return deferred.promise;
          }

          //
          // Prepare description and relationship id references and names from the error messages
          //
          function prepareReferencedComponents() {
            var deferred = $q.defer();
            var failuresPrepared = 0;

            angular.forEach(scope.failures, function (failure) {

              // try to detect referenced descriptions/relationships
              var matchInfo = failure.detail.match(/[id[=:]+]*(\d+[12]\d)[^\d]/i);

              if (matchInfo) {

                // different behavior depending on description vs. relationship
                switch (matchInfo[1].substring(matchInfo[1].length - 2, matchInfo[1].length - 1)) {
                  case '1':
                    terminologyServerService.getDescriptionProperties(matchInfo[1], scope.branch).then(function (description) {

                      // apply the reference
                      failure.referencedComponentId = matchInfo[1];
                      failure.referencedComponentType = 'Description';
                      if (description && description.term) {
                        failure.detail = failure.detail.replace(matchInfo[0], '\"' + description.term + '\"');
                      }                      

                      if (++failuresPrepared === scope.failures.length) {
                        deferred.resolve();
                      }
                    });
                    break;
                  case '2':
                    failure.referencedComponentId = matchInfo[1];
                    failure.referencedComponentType = 'Relationship';
                    if (++failuresPrepared === scope.failures.length) {
                      deferred.resolve();
                    }
                    break;
                  default:
                    console.error('improperly matched descriptions/relationships');
                    deferred.reject('Improper matching for descriptions/relationships');
                }
              } else {
                if (++failuresPrepared === scope.failures.length) {
                  deferred.resolve();
                }
              }

              deferred.resolve();
            });
            return deferred.promise;
          }

          // called by failureTableParams.getData(), retrieves names if needed
          function getNamesForFailures() {
            return $q.all([prepareReferencedComponents(), getConceptNames()]);
          }

          // declare table parameters
          scope.failureTableParams = new NgTableParams({
              page: 1,
              count: 10,
              sorting: {userModified: 'desc'},
              orderBy: 'userModified'
            },
            {
              total: '-',
              getData: function ($defer, params) {
                // clear the loading variable on reload
                scope.failuresLoading = false;

                if (!scope.failures || scope.failures.length === 0) {
                  params.total(0); // resolving empty array does not actually set total to 0
                  $defer.resolve([]);
                } else {
                  
                  // filter by user modification
                  var orderedData = scope.failures.filter(function (failure) {
                    return scope.viewFullReport || failure.isBranchModification;
                  });

                  // filter by user exclusion
                  if (scope.warningAssertion) {
                    orderedData = orderedData.filter(function (failure) {
                      return scope.allWhitelistItems.filter(function(item) {
                        return item.validationRuleId === failure.validationRuleId && failure.componentId === item.componentId; 
                      }).length === 0;
                    });
                  } else {
                    orderedData = orderedData.filter(function (failure) {
                      return !validationService.isValidationFailureExcluded(scope.assertionFailureViewed.assertionUuid, failure.conceptId, failure.detailUnmodified);
                    });
                  }

                  params.total(orderedData.length);
                  orderedData = params.sorting() ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;
                  orderedData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
                  $defer.resolve(orderedData);
                }
              }
            }
          );


          // declare table parameters
          scope.exclusionsTableParams = new NgTableParams({
              page: 1,
              count: 10,
              sorting: {},
              orderBy: 'timestamp'
            },
            {
              total: '-',
              getData: function ($defer, params) {

                var orderedData = [];
                scope.allWhitelistItems.forEach(function(item) {
                  orderedData.push({
                    id: item.id,
                    failureText: item.failureText,
                    assertionUuid: item.validationRuleId,
                    branchRoot: item.branch,
                    conceptFsn: item.conceptFsn,
                    conceptId: item.conceptId,
                    componentId: item.componentId,
                    timestamp: new Date(item.creationDate).getTime(),
                    user: item.userId
                  });
                });

                var branchRoot = metadataService.isExtensionSet() ? metadataService.getBranchRoot().split('/').pop() : 'MAIN'; 
                validationService.getValidationFailureExclusions().then(function (exclusions) {
                  for (var key in exclusions) {
                    angular.forEach(exclusions[key], function (failure) {
                      if (!failure.hasOwnProperty('branchRoot') || failure['branchRoot'] === branchRoot || failure['branchRoot'].includes(branchRoot) || branchRoot.includes(failure['branchRoot'])) {
                        orderedData.push(failure);
                      }                      
                    });
                  }                 

                  params.total(orderedData.length);
                  orderedData = params.sorting() ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;
                  orderedData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
                  $defer.resolve(orderedData);
                });
              }
            }
          );

          scope.viewExclusions = false;

          scope.toggleViewExclusions = function () {
            scope.viewExclusions = !scope.viewExclusions;
            if (scope.viewExclusions) {
              scope.exclusionsTableParams.reload();
            }
          };

          scope.toggleViewFullListExceptions = function () {
            //scope.viewFullListException = !scope.viewFullListException;
            scope.allWhitelistItems = [];
            scope.exclusionsTableParams.reload();   
            checkWhitelist().then(function() {
              scope.exclusionsTableParams.reload();
              setTimeout(function(){
                angular.element(document.activeElement).trigger('blur');
              });
            });                     
          };

          var dlcDialog = (function (data, fileName) {
            // create the hidden element
            var a = document.createElement('a');
            document.body.appendChild(a);
    
            return function (data, fileName) {
              var
                blob = new Blob([data], {type: 'text/tab-separated-values'}),
                url = window.URL.createObjectURL(blob);
              a.href = url;
              a.download = fileName;
              a.click();
              window.URL.revokeObjectURL(url);
            };
          }());

          function convertToCSV(objArray) {
            var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
            var str = '';
            for (var i = 0; i < array.length; i++) {
                var line = '';
                for (var index in array[i]) {
                    if (line != '') line += '\t';
                    line += array[i][index];
                }
                str += line + '\r\n';
            }
            return str;
          }
          
          scope.downloadExceptions = function () {
            var data = [];
            data.push({
              'conceptId': 'Concept',
              'conceptFsn': 'FSN',
              'componentId': 'Component ID',
              'failureText': 'Error Message',
              'creationDate': 'Date Added',
              'user': 'User'
            });
            scope.allWhitelistItems.forEach(function(item) {
              data.push({
                'conceptId': item.conceptId,
                'conceptFsn': item.conceptFsn,
                'componentId': item.componentId,
                'failureText': item.failureText ? item.failureText : '',
                'creationDate': item.creationDate,
                'user': item.userId
              });
            })                        
            dlcDialog(convertToCSV(data), 'Exceptions_' + (new Date()).getTime());
          };                    

          scope.reloadTables = function () {
            if (scope.viewTop) {
              scope.failedAssertionsTableParams.reload();
              scope.warningAssertionsTableParams.reload();
            } else {
              scope.failureTableParams.reload();
            }
            if (scope.viewExclusions) {
              scope.exclusionsTableParams.reload();
            }
          };

          //
          // Assertion failure and individual failure computation
          //

          // controls for viewing full vs. task report
          scope.viewFullReport = false;
          scope.toggleFullReport = function () {
            scope.viewFullReport = !scope.viewFullReport;
            scope.reloadTables();
          };

          scope.userModifiedConceptIds = [];
            
          scope.generateWhitelistFields = function(whitelistItems){
              let idList = [];
              angular.forEach(whitelistItems, function (item) {
                    angular.forEach(scope.assertionsWarning, function (assertion) {
                        if(item.validationRuleId === assertion.assertionUuid){
                            item.failureText = assertion.assertionText;
                        }
                    });
                    angular.forEach(scope.validationContainer.report.rvfValidationResult.TestResult.assertionspassed, function (assertion) {
                        if(item.validationRuleId === assertion.assertionUuid){
                            item.failureText = assertion.assertionText;
                        }
                    });
                    idList.push(item.conceptId);
                });
                terminologyServerService.bulkGetConceptUsingPOST(idList, scope.branch).then(function (concepts) {
                  angular.forEach(concepts.items, function (concept) {
                      angular.forEach(whitelistItems, function (failure) {
                        if(failure.conceptId === concept.conceptId){
                            failure.conceptFsn = concept.fsn.term;
                        }
                      });

                  });
                scope.reloadTables();
                });
            
            return whitelistItems
          }

          function getWhitelistCreationDate() {
            var deferred = $q.defer();
            if (scope.viewFullListException) {
              let projectShortname;
              if (scope.task) {
                projectShortname = metadataService.getProjectForKey(scope.task.projectKey).codeSystem.shortName;
              } else {
                projectShortname = metadataService.getBranchMetadata().codeSystem.shortName;
              }
              terminologyServerService.getAllCodeSystemVersionsByShortName(projectShortname).then(function(response) {
                if (response.data.items && response.data.items.length > 0) {
                  deferred.resolve(response.data.items[response.data.items.length-1].importDate);
                }
              });
            } else {
              terminologyServerService.getLastPromotionTimeToMain(scope.branch).then(function(promotionDate) {
                deferred.resolve(promotionDate);
              });
            }            
            return deferred.promise;
          }

          function checkWhitelist() {
            var deferred = $q.defer();
            scope.exceptionLoading = true;
            // filter out from AAG whitelist
            getWhitelistCreationDate().then(function (creationDate) { 
              let branch = '';
              if(scope.viewFullListException && scope.task){
                  branch =  scope.branch.substr(0, scope.branch.lastIndexOf("\/"));
                  branch =  branch.substr(0, branch.lastIndexOf("\/"));
              }
              else if(scope.viewFullListException && !scope.task){
                  branch =  scope.branch.substr(0, scope.branch.lastIndexOf("\/"));
              }
              else {
                  branch = scope.branch;
              }
              aagService.getWhitelistItemsByBranchAndDate(branch, new Date(creationDate).getTime()).then(function(whitelistItems) {
                if(whitelistItems !== undefined){
                  let idList = [];
                  angular.forEach(whitelistItems, function (item) {
                      if(item.assertionFailureText !== null){
                          item.failureText = item.assertionFailureText;
                      }
                      else{
                          angular.forEach(scope.assertionsWarning, function (assertion) {
                          if(item.validationRuleId === assertion.assertionUuid){
                              item.failureText = assertion.assertionText;
                          }
                          });
                          angular.forEach(scope.validationContainer.report.rvfValidationResult.TestResult.assertionspassed, function (assertion) {
                              if(item.validationRuleId === assertion.assertionUuid){
                                  item.failureText = assertion.assertionText;
                              }
                          });
                      }
                      idList.push(item.conceptId);
                  });

                  terminologyServerService.bulkGetConceptUsingPOST(idList, scope.branch).then(function (concepts) {
                    angular.forEach(concepts.items, function (concept) {
                        angular.forEach(whitelistItems, function (failure) {
                          if(failure.conceptId === concept.conceptId){
                              failure.conceptFsn = concept.fsn.term;
                          }
                        });
                    });
                    scope.allWhitelistItems = whitelistItems;
                    angular.forEach(scope.assertionsWarning, function (assertion) {
                      if(assertion.failureCount > 0 && assertion.testType === 'DROOL_RULES'){
                          assertion.isBranchModification = false;                  
                          angular.forEach(assertion.firstNInstances, function (instance) {

                            // store the unmodified text to preserve original data
                            instance.detailUnmodified = instance.detail;

                            // detect if instance references user modified concepts
                            if (scope.userModifiedConceptIds.indexOf(String(instance.conceptId)) !== -1) {
                              instance.isBranchModification = true;
                              assertion.isBranchModification = true;
                            }
                          });
                      }
                    });
                    scope.exceptionLoading = false;
                    deferred.resolve();                    
                  });
                }
              }, function() {
                scope.exceptionLoading = false;
              });
            }, function() {
              scope.exceptionLoading = false;
            });
            return deferred.promise;
          };

          function initViewableFlagForFailures() {
            // set the viewable flags for all returned failure instances
            angular.forEach(scope.assertionsFailed, function (assertion) {
              if(assertion.failureCount !== -1) {
                assertion.isBranchModification = false;                    
                angular.forEach(assertion.firstNInstances, function (instance) {

                  // store the unmodified text to preserve original data
                  instance.detailUnmodified = instance.detail;

                  // detect if instance references user modified concepts
                  if (scope.userModifiedConceptIds.indexOf(String(instance.conceptId)) !== -1) {
                    instance.isBranchModification = true;
                    assertion.isBranchModification = true;
                  }
                });
              }
            });
          }

          function initFailures() {

            var deferred = $q.defer();         

            // extract the failed assertions
            scope.assertionsFailed = scope.validationContainer.report.rvfValidationResult.TestResult.assertionsFailed;
            scope.assertionsWarning = scope.validationContainer.report.rvfValidationResult.TestResult.assertionsWarning;
            
            checkWhitelist().then(function() {
              initViewableFlagForFailures();
              scope.reloadTables();
              deferred.resolve();
            });

            return deferred.promise;
          }

          // watch for changes in the validation in order to populate tables
          var failuresInitialized = false;

          scope.$watch('validationContainer', function (newVal, oldVal) {

            if (!scope.validationContainer || !scope.validationContainer.report) {
              return;
            }

            // only initialize once -- watch statement fires multiple times otherwise
            if (failuresInitialized) {
              return;
            }
            failuresInitialized = true;            

            notificationService.sendMessage('Retrieving traceability information ...');
            terminologyServerService.getTraceabilityForBranch(scope.branch).then(function (traceability) {

              // if traceability found, extract the user modified concept ids
              if (traceability) {
                angular.forEach(traceability.content, function (change) {
                  // if content change and concept change, push the id
                  if (change.activityType === 'CONTENT_CHANGE') {
                    angular.forEach(change.conceptChanges, function (conceptChange) {
                      if (scope.userModifiedConceptIds.indexOf(conceptChange.conceptId) === -1) {
                        scope.userModifiedConceptIds.push(String(conceptChange.conceptId));
                      }
                    });
                  }
                });

              } else {
                notificationService.sendWarning('Could not retrieve traceability for task');
              }

              // initialize the failures
              notificationService.sendMessage('Initializing validation failures...');
              initFailures().then(function () {
                notificationService.sendMessage('Initialization complete', 3000);
                scope.initializationComplete = true;
              });
            }, function (error) {
              notificationService.sendMessage('Initializing validation failures...');
              initFailures().then(function () {
                notificationService.sendMessage('Initialization complete', 3000);
                scope.initializationComplete = true;
              });
            });
          }, true); // make sure to check object inequality, not reference!


          scope.viewFailures = function (assertionFailure, warningAssertion) {
            scope.assertionFailureViewed = assertionFailure;
            scope.viewTop = false;
            scope.warningAssertion = warningAssertion;
            scope.failuresLoading = true;

            var objArray = [];

            if (warningAssertion) {
              scope.whitelistEnabled = true;
            }

            angular.forEach(assertionFailure.firstNInstances, function (instance) {

              // NOTE: store the unmodified failure text
              var obj = {
                conceptId: instance.conceptId,
                detail: instance.detail,
                detailUnmodified : instance.detailUnmodified,
                selected: false,
                isBranchModification: instance.isBranchModification,
                isUserExclusion: instance.isUserExclusion,
                validationRuleId: assertionFailure.assertionUuid,
                assertionText: assertionFailure.assertionText,
                componentId: instance.componentId
              };

              objArray.push(obj);
            });


            scope.failures = objArray;
            getNamesForFailures().then(function () {
              scope.failureTableParams.reload();
            }, function () {
              scope.failureTableParams.reload();
            });
          }
          ;

          scope.downloadFailures = function(assertionFailure) {
            var objArray = [];
            var promises = [];
            conceptIds = [];

            angular.forEach(assertionFailure.firstNInstances, function (instance) {
              promises.push(getConceptIdForFailure(instance));
              var obj = {
                conceptId: instance.conceptId,                       
              };
              objArray.push(obj);
            });                 

            $q.all(promises).then(function () {
               // skip if no concept ids
              if (conceptIds.length > 0) {

              // bulk call for concept ids
              terminologyServerService.bulkGetConceptUsingPOST(conceptIds, scope.branch).then(function (concepts) {
                var idNameMap = {};
                angular.forEach(concepts.items, function (concept) {
                  idNameMap[concept.id] = concept.fsn.term;
                });
                angular.forEach(objArray, function (failure) {
                  failure.conceptFsn = idNameMap[failure.conceptId];
                });

                objArray.unshift({
                  conceptId: 'Concept ID',
                  conceptFsn : 'FSN'
                });
                var fileName = 'validation_' + (new Date()).getTime();
                scope.dlcDialog(convertToCSV(objArray), fileName);        
              });
              } 
            });
          };

          function convertToCSV(objArray) {
            var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
            var str = '';

            for (var i = 0; i < array.length; i++) {
                var line = '';
                for (var index in array[i]) {
                    if (line != '') line += '\t'

                    line += array[i][index];
                }

                str += line + '\r\n';
            }

            return str;
          }

          // creates element for dialog download of classification data
          scope.dlcDialog = (function (data, fileName) {

            // create the hidden element
            var a = document.createElement('a');
            document.body.appendChild(a);

            return function (data, fileName) {
              var
              blob = new Blob([data], {type: 'text/tab-separated-values'}),
              url = window.URL.createObjectURL(blob);
              a.href = url;
              a.download = fileName;
              a.click();
              window.URL.revokeObjectURL(url);
            };
          }());

          scope.selectAll = function (selectAllActive) {
            angular.forEach(scope.failures, function (failure) {
              failure.selected = selectAllActive;
            });
          };

          /**
           * Remove concepts from viewed list on stopEditing events from
           * conceptEdit
           */
          scope.$on('stopEditing', function (event, data) {
            for (var i = 0; i < scope.viewedConcepts.length; i++) {
              if (scope.viewedConcepts[i].conceptId === data.concept.conceptId) {
                scope.viewedConcepts.splice(i, 1);
                return;
              }
            }
          });

//
// User-modified validation exclusion list
//

          scope.removeUserExclusionFromTable = function (failure) {
            if (failure.id) {
              aagService.removeFromWhitelist(failure.id).then(function() {
                scope.allWhitelistItems = scope.allWhitelistItems.filter(function(item) {
                  return item.id !== failure.id;
                });
                scope.resetUserExclusionFlag();
                scope.reloadTables();
              });
            } else {
              validationService.removeValidationFailureExclusion(failure.assertionUuid, failure.conceptId, failure.failureText).then(function () {
                scope.reloadTables();
              });
            }            
          };

// exclude a single failure, with optional commit
          scope.excludeFailure = function (failure) {
            if (scope.warningAssertion){
              getAdditionalFieldsAsString(scope.branch, failure.componentId).then(function(result) {
                var whitelistItem = {};
                whitelistItem.componentId = failure.componentId;
                whitelistItem.conceptId = failure.conceptId;
                whitelistItem.validationRuleId = failure.validationRuleId;
                whitelistItem.branch = scope.branch;
                whitelistItem.additionalFields = result[failure.componentId];
                whitelistItem.assertionFailureText = failure.assertionText;
                aagService.addToWhitelist(whitelistItem).then(function(respone) {
                  scope.allWhitelistItems.push(respone.data);
                  scope.allWhitelistItems = scope.generateWhitelistFields(scope.allWhitelistItems);
                  failure.isUserExclusion = true;
                  scope.resetUserExclusionFlag();
                });
              });                           
            }
          };

          function getAdditionalFieldsAsString(branch, componentId) {
            var deferred = $q.defer();
            var SCTID_PATTERN = new RegExp("\\d{6,20}$");
            var UUID_PATTERN = new RegExp("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");            
            if (SCTID_PATTERN.test(componentId)){
              switch (componentId.substr(-2, 1)) {
                case "0":
                  terminologyServerService.getConceptProperties(componentId, branch).then(function(concept) {
                    deferred.resolve({[componentId]: getStatusCode(concept.active) + ',' + concept.moduleId + ',' + getDefinitionStatusId(concept.definitionStatus)});
                  });
                  break;
                case "1":
                  terminologyServerService.getDescriptionProperties(componentId, branch).then(function(desc) {                    
                    deferred.resolve({[componentId]: getStatusCode(desc.active) + ',' + desc.moduleId + ',' + desc.conceptId + ',' + desc.lang + ',' + desc.typeId + ',' + desc.term + ',' + getCaseSignificanceId(desc.caseSignificance)});
                  });
                  break;
                case "2":
                  terminologyServerService.getRelationshipProperties(componentId, branch).then(function(rel) {
                    deferred.resolve({[componentId]: getStatusCode(rel.active) + ',' + rel.moduleId + ',' + rel.sourceId + ',' + rel.destinationId + ',' + rel.groupId + ',' + rel.typeId + ',' + getCharacteristicTypeId(rel.characteristicTypeId)});
                  });
                  break;
                default:
                  deferred.resolve({[componentId]: ''});
                  break;        
              }        
            } else if (UUID_PATTERN.test(componentId)) {
              terminologyServerService.getMemberProperties(componentId, branch + '/').then(function(member) {
                var result = getStatusCode(member.active) + ',' + member.moduleId + ',' + member.refsetId + ',' + member.referencedComponentId;
                for (var key in Object.keys(member.additionalFields)) {                 
                  result += (',' + member.additionalFields[key]);
                }
                deferred.resolve({[componentId]: result});
              });
              
            } else {
              deferred.resolve({[componentId]: ''});
            }
            return deferred.promise;
          }

          function getCaseSignificanceId(caseSignificance) {
            switch (caseSignificance) {
              case 'INITIAL_CHARACTER_CASE_INSENSITIVE':
                return '900000000000020002';
              case 'CASE_INSENSITIVE':
                return '900000000000448009';
              case 'ENTIRE_TERM_CASE_SENSITIVE':
                return '900000000000017005';
              default:
                return '';
            }
          };

          function getCharacteristicTypeId(characteristicType) {
            return characteristicType === 'INFERRED_RELATIONSHIP'? '900000000000011006' : '900000000000010007';
          }

          function getDefinitionStatusId(definitionStatus) {
            return definitionStatus === 'PRIMITIVE' ? '900000000000074008' : '900000000000073002';
          }

          function getStatusCode(status) {
            return status ? '1' : '0';
          }

          scope.resetUserExclusionFlag = function() {
            angular.forEach(scope.assertionsWarning, function (assertion) {
              if(assertion.failureCount > 0 && assertion.testType === 'DROOL_RULES'){                                   
                  angular.forEach(assertion.firstNInstances, function (instance) {
                    instance.isUserExclusion = scope.allWhitelistItems.filter(function(item) {
                      return item.validationRuleId === assertion.assertionUuid && instance.componentId === item.componentId; 
                    }).length !== 0;
                  });
              }
            });
          };

          scope.isExcluded = function (failure) {
            validationService.isValidationFailureExcluded(scope.assertionFailureViewed.assertionUuid, failure.conceptId, failure.detailUnmodified);
          };

          /**
           * Function to add a concept by id to the list
           * Used by single editConcept or multiple editSelectedConcept methods
           * @param conceptId
           * @returns {*|promise}
           */
          function editConceptHelper(failure) {
            var deferred = $q.defer();

            // clear existing styles
            scope.styles[failure.conceptId] = {};

            // if failure has a component id, set new styling
            if (failure.referencedComponentId) {
              var componentStyling =
              scope.styles[failure.conceptId][failure.referencedComponentId] = {
                message: failure.detail, style: 'redhl'
              }
            }

            terminologyServerService.getFullConcept(failure.conceptId, scope.branch).then(function (response) {
              if (!scope.viewedConcepts || !Array.isArray(scope.viewedConcepts)) {
                scope.viewedConcepts = [];
              }
              scope.viewedConcepts.push(response);
              deferred.resolve(response);
            }, function (error) {
              deferred.reject(); // no error passing, for count purposes only
            });

            return deferred.promise;
          }

          scope.editConcept = function (failure) {           
            
            // Already loaded check
            if(scope.viewedConcepts 
              && scope.viewedConcepts.length > 0
              && scope.viewedConcepts.filter(function(item) { return item.conceptId === failure.conceptId; }).length === 1) {
              notificationService.sendWarning('Concept already loaded');              
              return;
            }

            notificationService.sendMessage('Loading concept...');
            editConceptHelper(failure).then(function (response) {
              notificationService.sendMessage('Concept loaded', 5000);

              $timeout(function () {
                $rootScope.$broadcast('viewTaxonomy', {
                  concept: {
                    conceptId: failure.conceptId,
                    fsn: response.fsn
                  }
                });
              }, 500);
            }, function (error) {
              notificationService.sendError('Error loading concept', 5000);
            });

          };

          scope.editSelectedConcepts = function () {
            var nConcepts = 0;
            notificationService.sendMessage('Loading concepts...');

            // construct array of concept ids for previously loaded concepts
            var existingIds = scope.viewedConcepts.map(function (viewed) {
              return viewed.conceptId;
            });

            var failuresToLoad = scope.failures.filter(function (failure) {
              return failure.selected && existingIds.indexOf(failure.conceptId.toString()) === -1;
            });

            var conceptsLoaded = 0;
            angular.forEach(failuresToLoad, function (failure) {

              // add the concept
              editConceptHelper(failure).then(function () {

                if (++conceptsLoaded === failuresToLoad.length) {
                  notificationService.sendMessage('Concepts loaded.', 5000);
                }
              }, function (error) {
                notificationService.sendError('Error loading at least one concept');
              });

            });
          };

          scope.excludeFailures = function () {
            var failures = scope.failureTableParams.data;
            var failuresToAddWhiteList = failures.filter(function (failure) {
              return failure.selected;
            });

            if(failuresToAddWhiteList.length === 0) {
              return;
            }

            if (scope.warningAssertion){
              var promises = [];
              angular.forEach(failuresToAddWhiteList, function (failure) {                
                failure.isUserExclusion = true;
                promises.push(getAdditionalFieldsAsString(scope.branch,failure.componentId));
              });
              $q.all(promises).then(function (responses) {
                promises = [];
                angular.forEach(failuresToAddWhiteList, function (failure) {
                  var whitelistItem = {};                
                  whitelistItem.componentId = failure.componentId;
                  whitelistItem.conceptId = failure.conceptId;
                  whitelistItem.validationRuleId = failure.validationRuleId;
                  whitelistItem.branch = scope.branch;
                  whitelistItem.assertionFailureText = failure.assertionText;
                  whitelistItem.additionalFields = responses.filter(function(item){
                    return item.hasOwnProperty(failure.componentId);
                  })[0][failure.componentId];
                  promises.push(aagService.addToWhitelist(whitelistItem));
                });
                $q.all(promises).then(function (results) {
                  results.forEach(function(item, current, array) {
                    scope.allWhitelistItems.push(item.data);
                    if (current === array.length - 1){
                        scope.allWhitelistItems = scope.generateWhitelistFields(scope.allWhitelistItems);
                    }
                  });
                  scope.resetUserExclusionFlag()
                });
              });              
            } else {
              accountService.getAccount().then(function (accountDetails) {
                // get the user name
                var userName = !accountDetails || !accountDetails.login ? 'Unknown User' : accountDetails.login;
                var branchRoot = metadataService.isExtensionSet() ? metadataService.getBranchRoot().split('/').pop() : 'MAIN';
  
                // set the local flag to false to ensure immediate removal
                angular.forEach(failuresToAddWhiteList, function (failure) {                
                  failure.isUserExclusion = true;
                });              
  
                // add the exclusion and update tables
                // NOTE: Must use the unmodified detail, not the referenced component modified detail
                validationService.addValidationFailuresExclusion(scope.assertionFailureViewed.assertionUuid,
                  scope.assertionFailureViewed.assertionText,
                  failuresToAddWhiteList,
                  userName,
                  branchRoot).then(function () {
  
                  scope.reloadTables();
                });
              });
            }
          };

          scope.openCreateTaskModal = function (task, editList, savedList) {

            var modalInstance = $modal.open({
              templateUrl: 'shared/task/task.html',
              controller: 'taskCtrl',
              resolve: {
                task: function () {
                  return task;
                },
                canDelete: function () {
                  return false;
                }
              }
            });

            modalInstance.result.then(function (task) {

              notificationService.sendMessage('Task ' + task.key + ' created', -1, '#/tasks/task/' + task.projectKey + '/' + task.key + '/edit');

              scaService.saveUiStateForTask(task.projectKey, task.key, 'edit-panel', editList).then(function (response) {
                scaService.saveUiStateForTask(task.projectKey, task.key, 'saved-list', {items: savedList}); // TODO Seriously rethink the saved list
              });

            }, function () {
            });
          };

          scope.createTaskFromFailures = function () {

            notificationService.sendMessage('Constructing task from project validation...');

            // attempt to construct the edit list from user selections
            var editList = [];
            angular.forEach(scope.failures, function (failure) {
              if (editList.selected && editList.indexOf(failure.errorMessage.conceptId) === -1) {
                editList.push(failure.errorMessage.conceptId);
              }
            });

            // if edit list is empty, use all failure instances
            angular.forEach(scope.failures, function (failure) {
              if (editList.indexOf(failure.errorMessage.conceptId === -1)) {
                editList.push(failure.errorMessage.conceptId);
              }
            });

            // temporary restriction on number of items to prevent giant server
            // load
            if (editList.length > 10) {
              notificationService.sendWarning('No more than 20 scope.failures can be put into a task at this time');
              return;
            }

            notificationService.sendMessage('Adding concept information to new task ...');

            // retrieve the requested concept information and construct the
            // saved list
            var idConceptMap = {};
            var savedList = [];
            angular.forEach(editList, function (conceptId) {
              terminologyServerService.getFullConcept(conceptId, scope.branch).then(function (response) {

                // add concept to map for properties retrieval (for task detail)
                idConceptMap[conceptId] = response.fsn;

                // construct the saved list item
                var savedListItem = {
                  active: response.active,
                  concept: {
                    conceptId: conceptId,
                    fsn: response.fsn,
                    active: response.active,
                    definitionStatus: response.definitionStatus,
                    moduleId: response.moduleId
                  }
                };

                savedList.push(savedListItem);
                notificationService.sendMessage('Adding concept information to new task... (' + (savedList.length) + '/' + editList.length + ')');

                if (savedList.length === editList.length) {

                  notificationService.sendMessage('Creating task...');

                  // construct the saved list and task details
                  var taskDetails = 'Error Type: ' + scope.assertionFailureViewed + '\n\n';
                  angular.forEach(scope.failures, function (failure) {
                    // if this concept was encountered, add it to details
                    if (idConceptMap[failure.errorMessage.conceptId]) {
                      taskDetails += 'Concept: ' + idConceptMap[failure.errorMessage.conceptId] + ', Error: ' + failure.errorMessage.detail + '\n';
                    }
                  });

                  var task = {
                    projectKey: $routeParams.projectKey,
                    summary: 'Validation errors found at project level',
                    description: taskDetails
                  };

                  scope.openCreateTaskModal(task, editList, savedList);
                }
              });
            });

          };
        }

      }
        ;

    }])
;
