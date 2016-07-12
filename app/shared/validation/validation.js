'use strict';

angular.module('singleConceptAuthoringApp')

  .directive('validation', ['$rootScope', '$filter', '$q', 'ngTableParams', '$routeParams', 'configService', 'scaService', 'snowowlService', 'notificationService', 'accountService', '$timeout', '$modal',
    function ($rootScope, $filter, $q, NgTableParams, $routeParams, configService, scaService, snowowlService, notificationService, accountService, $timeout, $modal) {
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
          branch: '='
        },
        templateUrl: 'shared/validation/validation.html',

        link: function (scope, element, attrs, linkCtrl) {

          // sets view to top and clears viewed concept list
          scope.setViewTop = function () {
            scope.viewTop = true;
            scope.viewedConcepts = [];
          };


          scope.editable = attrs.editable === 'true';
          scope.showTitle = attrs.showTitle === 'true';
          scope.displayStatus = '';
          scope.taskKey = $routeParams.taskKey;
          scope.isCollapsed = false;
          scope.setViewTop();

          scope.getSNF = function (id) {
            var deferred = $q.defer();
            snowowlService.getConceptSNF(id, scope.branch).then(function (response) {
              deferred.resolve(response);
            });
            return deferred.promise;
          };

          scope.conceptUpdateFunction = function (project, task, concept) {
            var deferred = $q.defer();
            snowowlService.updateConcept(project, task, concept).then(function (response) {
              deferred.resolve(response);
            });
            return deferred.promise;
          };
          // instantiate validation container if not supplied
          if (!scope.validationContainer) {
            scope.validationContainer = {executionStatus: '', report: ''};
          }

          //console.debug('entered validation.js', scope.validationContainer);

          // the rules to exclude
          configService.getExcludedValidationRuleIds().then(function (response) {
            scope.assertionsExcluded = response;
          });

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

            if (scope.validationContainer.report && scope.validationContainer.report.rvfValidationResult) {

              // get the end time if specified
              if (scope.validationContainer.report.rvfValidationResult.endTime) {
                var endTime = scope.validationContainer.report.rvfValidationResult.endTime;
                return status + ' ' + endTime;
              }

              if (scope.validationContainer.report.rvfValidationResult.startTime) {
                var startTime = scope.validationContainer.report.rvfValidationResult.startTime;
                return status + ', started ' + startTime;
              }
            }

            return status;
          };

          // declare table parameters
          scope.topTableParams = new NgTableParams({
              page: 1,
              count: 10,
              sorting: {failureCount: 'desc'},
              orderBy: 'failureCount'
            },
            {
              filterDelay: 50,
              total: scope.assertionsFailed ? scope.assertionsFailed.length : 0,
              getData: function ($defer, params) {

                if (!scope.assertionsFailed || scope.assertionsFailed.length === 0) {
                  $defer.resolve([]);
                } else {

                  // filter by user modification
                  var orderedData = scope.assertionsFailed.filter(function (assertionFailed) {
                    return !scope.restrictByTraceability || assertionFailed.isUserModified;
                  });

                  // filter by user exclusion
                  orderedData = orderedData.filter(function (assertionFailed) {
                    return true; // TODO Filter when ALL instances are user excluded
                  });


                  params.total(orderedData.length);
                  orderedData = params.sorting() ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;

                  $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                }
              }
            }
          );


          // called by failureTableParams.getData(), retrieves names if needed
          function getNamesForFailures() {
            return $q.all([getDescriptionNames(), getConceptNames()]);
          }

          var conceptIds = [];

          function getConceptIdForFailure(failure) {
            var deferred = $q.defer();
            switch (String(failure.conceptId).substring(String(failure.conceptId).length - 3, String(failure.conceptId).length - 2)) {
              // concept: simply return
              case '0':
                conceptIds.push(failure.conceptId);
                deferred.resolve();
                break;
              // description: get description by id, replace with concept id
              case '1':
                snowowlService.getDescriptionProperties(failure.conceptId, scope.branch).then(function (desc) {
                  failure.conceptId = desc.conceptId;
                  conceptIds.push(desc.conceptId);
                  deferred.resolve();
                }, function (error) {
                  deferred.reject();
                });
                break;
              // relationship: get relationship by id, replace with source concept id
              case '2':
                snowowlService.getRelationshipProperties(failure.conceptId, scope.branch).then(function (rel) {
                  failure.conceptId = rel.sourceId;
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
                snowowlService.bulkGetConcept(conceptIds, scope.branch).then(function (concepts) {
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

          function getDescriptionNames() {
            var deferred = $q.defer();
            var descsDone = 0;

            angular.forEach(scope.failures, function (failure) {


              // match the description
              var descIds = failure.message.match(/Description: id=(\d+)/);

              // if description found and display name not already retrieved and added
              if (descIds && descIds[1]) {
                snowowlService.getDescriptionProperties(descIds[1], scope.branch).then(function (description) {
                  failure.message = failure.message.replace(/Description: id=\d+/g, 'Description: ' + description.term);

                  if (++descsDone === scope.failures.length) {
                    deferred.resolve();
                  }
                });

              } else if (++descsDone === scope.failures.length) {
                deferred.resolve();
              }

            });
            return deferred.promise;
          }

          // called by failureTableParams.getData(), retrieves names if needed
          function getNamesForFailures() {
            return $q.all([getDescriptionNames(), getConceptNames()]);
          }

          // declare table parameters
          scope.failureTableParams = new NgTableParams({
              page: 1,
              count: 10,
              sorting: {userModified: 'desc'},
              orderBy: 'userModified'
            },
            {
              total: scope.failures ? scope.failures.length : 0,
              getData: function ($defer, params) {
                // clear the loading variable on reload
                scope.failuresLoading = false;

                if (!scope.failures || scope.failures.length === 0) {
                  $defer.resolve([]);
                } else {

                  // filter by user modification
                  var orderedData = scope.failures.filter(function (failure) {
                    return !scope.restrictByTraceability || failure.userModified;
                  });


                  // filter by user exclusion
                  orderedData = orderedData.filter(function (failure) {
                    return scope.showUserExcludedFailures || !failure.userExcluded;
                  });

//                  console.debug('ordered data', orderedData);
                  params.total(orderedData.length);
                  orderedData = params.sorting() ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;
                  orderedData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
                  // console.debug('ordered data', orderedData);
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
                scaService.getValidationFailureExclusions().then(function (exclusions) {
                  console.debug('exclusions table: exclusions', exclusions);

                  var failures = [];
                  for (var key in exclusions) {
                    failures = failures.concat(exclusions[key].excludedFailures);
                  }
                  console.debug('failures to retrieve names for', failures);

                  getConceptNames(failures).then(function () {
                    console.debug('got names for exclusions', scope.idNameMap);

                    for (var key in exclusions) {
                      angular.forEach(exclusions[key].excludedFailures, function (failure) {
                        failure.conceptFsn = scope.idNameMap[failure.conceptId];
                        orderedData.push(failure);
                      })
                    }

                    //     console.debug('ordered data', orderedData);
                    params.total(orderedData.length);
                    orderedData = params.sorting() ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;
                    orderedData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
                    //      console.debug('ordered data', orderedData);
                    $defer.resolve(orderedData);
                  })
                });
              }
            }
          );

          scope.viewExclusions = false;

          scope.toggleViewExclusions = function () {
            scope.viewExclusions = !scope.viewExclusions
            if (scope.viewExclusions) {
              scope.exclusionsTableParams.reload();
            }
          };

          scope.reloadTables = function () {
            if (scope.viewTop) {
              console.debug('reloading top table');
              scope.topTableParams.reload();
            } else {
              console.debug('reloading failure table')
              scope.failureTableParams.reload();
            }
            if (scope.viewExclusions) {
              scope.exclusionsTableParams.reload();
            }
          };

          //
          // Assertion failure and individual failure computation
          //
          scope.restrictByTraceability = true;

          scope.userModifiedConceptIds = [];

          function initFailures() {

            var deferred = $q.defer();

            // extract the failed assertions
            scope.assertionsFailed = scope.validationContainer.report.rvfValidationResult.sqlTestResult.assertionsFailed;

            // filter by configurable exclusion rules -- only in task view
            if ($routeParams.taskKey) {
              scope.assertionsFailed = scope.assertionsFailed.filter(function (assertion) {
                return scope.assertionsExcluded && Array.isArray(scope.assertionsExcluded) ? scope.assertionsExcluded.indexOf(assertion.assertionUuid) === -1 : true;
              });
            }

            // set the viewable flags for all returned failure instances
            angular.forEach(scope.assertionsFailed, function (assertion) {


              assertion.isUserModified = false;
              assertion.hasUserExclusions = false;
              angular.forEach(assertion.firstNInstances, function (instance) {


                // detect if category references user modified concepts
                if (scope.userModifiedConceptIds.indexOf(String(instance.conceptId)) !== -1) {
                  // console.debug('--> User modified instance', instance);
                  instance.isUserModified = true;
                  assertion.isUserModified = true;

                } else {
                  instance.isUserModified = false;
                }


                // detect if category references user-excluded failures
                if (scaService.isValidationFailureExcluded(assertion.assertionUuid, instance.conceptId, instance.detail)) {
                  console.debug('Failure exclusion found', assertion.assertionUuid, instance.conceptId, instance.detail);
                  assertion.hasUserExclusion = true;
                  instance.isUserExclusion = true;
                } else {
                  instance.isUserExclusion = false;
                }


              });
            });

            console.debug('assertionsFailed after init', scope.assertionsFailed);


            // reset view to full report
            scope.viewTop = true;

            // load the tables
            scope.topTableParams.reload();
            scope.failureTableParams.reload();

            deferred.resolve();

            return deferred.promise;


          }

          // watch for changes in the validation in order to populate tables
          var failuresInitialized = false;

          scope.$watch('validationContainer', function (newVal, oldVal) {

            scope.initializing = true;

            console.debug('validationContainer', newVal, oldVal);
            if (!scope.validationContainer || !scope.validationContainer.report) {
              console.debug('skipping');
              return;
            }


            // only initialize once -- watch statement fires multiple times otherwise
            if (failuresInitialized) {
              return;
            }
            failuresInitialized = true;

            if ($routeParams.taskKey) {
              notificationService.sendMessage('Retrieving traceability information ...');
              snowowlService.getTraceabilityForBranch($routeParams.projectKey, $routeParams.taskKey).then(function (traceability) {
                console.debug('traceability', traceability);


                // if traceability found, extract the user modified concept ids
                if (traceability) {
                  angular.forEach(traceability.content, function (change) {
                    //  console.debug('processing change', change.activityType, change.conceptChanges, change);
                    // if content change and concept change, push the id
                    if (change.activityType === 'CONTENT_CHANGE') {
                      angular.forEach(change.conceptChanges, function (conceptChange) {
                        // console.debug('  processing concept change', conceptChange);
                        if (scope.userModifiedConceptIds.indexOf(conceptChange.conceptId) === -1) {
                          scope.userModifiedConceptIds.push(String(conceptChange.conceptId));
                        }
                      });
                    }
                  });

                  console.debug(' modified concept ids ', scope.userModifiedConceptIds);

                } else {
                  notificationService.sendWarning('Could not retrieve traceability for task')
                }

                // initialize the failures
                notificationService.sendMessage('Initializing validation failures...');
                initFailures().then(function () {
                  notificationService.sendMessage('Initialization complete', 3000);
                  scope.initializing = false;
                });


              });
            } else {
              // initialize the failures
              notificationService.sendMessage('Initializing validation failures...');
              initFailures().then(function () {
                notificationService.sendMessage('Initialization complete', 3000);
                scope.initializing = false;
              });


            }


          }, true); // make sure to check object inequality, not reference!


          scope.viewFailures = function (assertionFailure) {

            console.debug('assertionFailure', assertionFailure);

            scope.assertionFailureViewed = assertionFailure.assertionText;
            scope.assertionFailureViewedUuid = assertionFailure.assertionUuid;
            scope.viewTop = false;

            scope.failuresLoading = true;

            var objArray = [];


            //console.debug(assertionFailure.firstNInstances);
            angular.forEach(assertionFailure.firstNInstances, function (instance) {

              var obj = {
                conceptId: instance.conceptId,
                message: instance.detail,
                selected: false,
                userModified: $routeParams.taskKey ? instance.isUserModified : false,
                userExcluded: instance.isUserExclusion
              };

              objArray.push(obj);
            });


            scope.failures = objArray;
            getNamesForFailures().then(function () {
              scope.failureTableParams.reload();
            });
          };

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

          // user toggle -- default false
          scope.showUserExcludedFailures = false;

          // on load, refresh the validation failure exclusions
          scaService.getValidationFailureExclusions().then(function (response) {
            console.debug('exclusions:', response);
          });

          // exclude a single failure, with optional commit
          scope.toggleUserExclusion = function (failure, skipCommitFlag) {
            console.debug('Toggling failure exclusion', failure.userExcluded, failure, skipCommitFlag);

            // NOTE: Logic reversed here as click event sets to NEW value, not old value
            if (!failure.userExcluded) {
              scaService.removeValidationFailureExclusion(scope.assertionFailureViewedUuid, failure.conceptId, failure.message);
              // TODO Currently unused, decide if we want batch behavior here
              if (!skipCommitFlag) {
                scaService.updateValidationFailureExclusions().then(function () {
                  scope.reloadTables();
                });
              }
            } else {

              accountService.getAccount().then(function (accountDetails) {
                // get the user name
                var userName = !accountDetails || !accountDetails.login ? 'Unknown User' : accountDetails.login;

                // synchronously update the exclusions
                scaService.addValidationFailureExclusion(scope.assertionFailureViewedUuid,
                  scope.assertionFailureViewed,
                  failure.conceptId,
                  failure.message,
                  userName);

                // "commit" the exclusion if flag set (flag not set used by exclude multiple failures)
                // TODO CUrrently unused, decide if we want batch behavior here
                if (!skipCommitFlag) {
                  scaService.updateValidationFailureExclusions().then(function () {
                    scope.reloadTables();
                  });
                }
              });
            }

          };

          scope.isExcluded = function (failure) {
            scaService.isValidationFailureExcluded(scope.assertionFailureViewedUuid, failure.conceptId, failure.message);
          };

          /**
           * Function to add a concept by id to the list
           * Used by single editConcept or multiple editSelectedConcept methods
           * @param conceptId
           * @returns {*|promise}
           */
          function editConceptHelper(conceptId) {
            var deferred = $q.defer();

            snowowlService.getFullConcept(conceptId, scope.branch).then(function (response) {
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

          scope.editConcept = function (conceptId) {

            var existingIds = scope.viewedConcepts.map(function (viewed) {
              return viewed.conceptId;
            });

            // NOTE: Requires string conversion based on RVF format
            if (existingIds.indexOf(conceptId.toString()) !== -1) {
              notificationService.sendWarning('Concept already loaded', 5000);
            } else {

              notificationService.sendMessage('Loading concept...');
              editConceptHelper(conceptId).then(function (response) {
                notificationService.sendMessage('Concept loaded', 5000);

                $timeout(function () {
                  $rootScope.$broadcast('viewTaxonomy', {
                    concept: {
                      conceptId: conceptId,
                      fsn: response.fsn
                    }
                  });
                }, 500);
              }, function (error) {
                notificationService.sendError('Error loading concept', 5000);
              });
            }
          };

          scope.editSelectedConcepts = function () {
            var nConcepts = 0;
            notificationService.sendMessage('Loading concepts...');

            //console.debug(scope.failures);

            // construct array of concept ids for previously loaded concepts
            var existingIds = scope.viewedConcepts.map(function (viewed) {
              return viewed.conceptId;
            });

            var conceptsToAdd = [];
            angular.forEach(scope.failures, function (failure) {
              if (failure.selected && existingIds.indexOf(failure.conceptId.toString()) === -1) {
                conceptsToAdd.push(failure.conceptId);
              }
            });

            //console.debug('existing ids', existingIds);

            // cycle over all failures
            var conceptsLoaded = 0;
            angular.forEach(conceptsToAdd, function (conceptId) {

              //console.debug('loading concept ', conceptId);

              // add the concept
              editConceptHelper(conceptId).then(function () {

                if (++conceptsLoaded === conceptsToAdd.length) {
                  notificationService.sendMessage('Concepts loaded.', 5000);
                }
              }, function (error) {
                notificationService.sendError('Error loading at least one concept');
              });
            });
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

              //console.debug('Task created', task.projectKey, task.key);

              scaService.saveUiStateForTask(task.projectKey, task.key, 'edit-panel', editList).then(function (response) {
                scaService.saveUiStateForTask(task.projectKey, task.key, 'saved-list', {items: savedList}); // TODO Seriously rethink the saved list
              });

            }, function () {
            });
          };

          scope.createTaskFromFailures = function () {

            notificationService.sendMessage('Constructing task from project validation...');

            //console.debug('scope.failures.firstNInstances', scope.failures, scope.failures.firstNInstances);

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

            //console.debug('editList', editList);

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
              snowowlService.getFullConcept(conceptId, scope.branch).then(function (response) {

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

                  //console.debug('idConceptMap', idConceptMap);

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

      };

    }])
;
