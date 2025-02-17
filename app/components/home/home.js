'use strict';
// jshint ignore: start
angular.module('singleConceptAuthoringApp.home', [
        //insert dependencies here
        'ngRoute',
        'ngTable'
    ])

    .config(function config($routeProvider) {
        $routeProvider
            .when('/home', {
                controller: 'HomeCtrl',
                templateUrl: 'components/home/home.html',
                resolve: ['terminologyServerService', 'metadataService', '$q', function(terminologyServerService, metadataService, $q) {
                    var defer = $q.defer();
                    $q.all([terminologyServerService.getEndpoint(), metadataService.isProjectsLoaded()]).then(function() {
                        defer.resolve();
                    });       
                    return defer.promise;
                  }
                ]
            });
    })

    .controller('HomeCtrl', function HomeCtrl($scope, $rootScope, $timeout, ngTableParams, $filter, $modal, $location, scaService, terminologyServerService, notificationService, metadataService, hotkeys, $q, modalService, $interval, localStorageService, accountService) {

        // clear task-related i nformation
        $rootScope.validationRunning = false;
        $rootScope.classificationRunning = false;
        $rootScope.automatedPromotionInQueued = false;

        // TODO Placeholder, as we only have the one tab at the moment
        $rootScope.pageTitle = "My Tasks";
        $scope.tasks = null;
        $scope.browserLink = '..';
        $scope.preferences = {};

        // flags for displaying promoted tasks
        $scope.showPromotedTasks = false;
        $scope.showPromotedReviews = false;
        $scope.projects = [];
        var loadingTask = false;
    
        $scope.typeDropdown = ['All'];
        $scope.selectedType = {type:''};
        $scope.selectedType.type = $scope.typeDropdown[0];

        if (!$rootScope.taskFilter || Object.keys($rootScope.taskFilter).length === 0) {
            $rootScope.taskFilter = {};
        }

        hotkeys.bindTo($scope)
            .add({
              combo: 'alt+t',
              description: 'Create a New Task',
              callback: function() {$scope.openCreateTaskModal();}
            })
            .add({
              combo: 'alt+l',
              description: 'Go to notification link',
              callback: function() {
                 $rootScope.$broadcast('gotoNotificationLink', {});
              }
            })
            .add({
              combo: 'alt+q',
              description: 'Close all concepts',
              callback: function() {$rootScope.$broadcast('closeAllOpenningConcepts', {});}
            });

        // declare table parameters
        $scope.tableParams = new ngTableParams({
                page: 1,
                count: localStorageService.get('table-display-number') ? localStorageService.get('table-display-number') : 10,
                sorting: $rootScope.taskFilter.sorting ? $rootScope.taskFilter.sorting : {updated: 'desc', name: 'asc'}
            },
            {
                filterDelay: 50,
                total: $scope.tasks ? $scope.tasks.length : 0, // length of data
                getData: function ($defer, params) {

                    // Store display number to local storage, then can be re-used later
                    if (!localStorageService.get('table-display-number')
                        || params.count() !== localStorageService.get('table-display-number')) {
                        localStorageService.set('table-display-number', params.count());
                    }

                    $rootScope.taskFilter.searchStr = params.filter().search;
                    $rootScope.taskFilter.sorting = params.sorting();

                    if (!$scope.tasks || $scope.tasks.length === 0) {
                        $defer.resolve([]);
                    } else {

                        var searchStr = params.filter().search;

                        var mydata = [];

                        if($scope.selectedType.type !== 'All'){
                           mydata = $scope.tasks.filter(function (item) {
                            if ($scope.selectedType.type === 'International') {
                                return !item.codeSystem.maintainerType
                            }   
                            else if(item.codeSystem) {
                                return item.codeSystem.maintainerType === $scope.selectedType.type
                            }
                            else return -1
                          }); 
                        }
                        if (searchStr) {
                            if($scope.selectedType.type === 'All'){
                                  mydata = $scope.tasks;
                              }
                            mydata = mydata.filter(function (item) {
                                return item.summary.toLowerCase().indexOf(searchStr.toLowerCase()) > -1
                                    || item.projectKey.toLowerCase().indexOf(searchStr.toLowerCase()) > -1
                                    || item.status.toLowerCase().indexOf(searchStr.toLowerCase()) > -1
                                    || item.key.toLowerCase().indexOf(searchStr.toLowerCase()) > -1
                                    || item.updated.indexOf(searchStr) > -1;
                            });
                        } else if ($scope.selectedType.type === 'All' && !searchStr) {
                          mydata = $scope.tasks;
                        }

                        if (!$scope.showPromotedTasks) {
                            mydata = mydata.filter(function (item) {
                                return item.status !== 'Promoted';
                            });
                        }

                        params.total(mydata.length);

                        mydata = params.sorting() ? $filter('orderBy')(mydata, params.orderBy()) : mydata;

                        if(params.sorting().feedbackMessageDate === 'asc' || params.sorting().feedbackMessageDate === 'desc'){
                            mydata.sort(function (a, b) {
                                return sortFeedbackFn(a, b, params.sorting().feedbackMessageDate);
                            });
                        }

                        if(params.sorting().status === 'asc' || params.sorting().status === 'desc'){
                            mydata.sort(function (a, b) {
                                return sortStatusFn(a, b, params.sorting().status);
                            });
                        }

                        $defer.resolve(mydata.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                    }

                }
            }
        );

        function sortFeedbackFn (a, b, direction) {
            if (a.feedbackMessageDate && b.feedbackMessageDate &&
                a.feedbackMessagesStatus === 'unread' && b.feedbackMessagesStatus === 'unread') {
                var dateA = new Date(a.feedbackMessageDate);
                var dateB = new Date(b.feedbackMessageDate);
                if (direction === 'asc') {
                    return dateA - dateB;
                } else {
                    return dateB - dateA;
                }
            } else if (a.feedbackMessageDate && a.feedbackMessagesStatus === 'unread') {
                return -1;
            } else if (b.feedbackMessageDate && b.feedbackMessagesStatus === 'unread') {
                return 1;
            } else if (a.feedbackMessagesStatus === 'read') {
                return -1;
            } else if (b.feedbackMessagesStatus === 'read') {
                return 1;
            } else {
                return 0;
            }
        }

        function sortStatusFn (a, b, direction) {
            a.tempStatus = (a.status == 'In Review' && (!a.reviewers || a.reviewers.length === 0)) ? 'Ready for Review' : a.status;
            b.tempStatus = (b.status == 'In Review' && (!b.reviewers || b.reviewers.length === 0)) ? 'Ready for Review' : b.status;
            if (direction === 'asc') {
                var result = a.tempStatus.localeCompare(b.tempStatus);
                delete a.tempStatus;
                delete b.tempStatus;
                return result;
            } else {
                var result = b.tempStatus.localeCompare(a.tempStatus);
                delete a.tempStatus;
                delete b.tempStatus;
                return result;
            }
        }

        $scope.toggleShowPromotedTasks = function () {
            $scope.showPromotedTasks = !$scope.showPromotedTasks;
            $rootScope.taskFilter.showPromoted = $scope.showPromotedTasks;
            loadTasks();
        };

        // TODO Workaround to capture full review functionality
        // Replace with loadAllTasks when endpoints are complete
        function loadTasks(disableNotification) {

            if (!disableNotification) {
                notificationService.sendMessage('Loading tasks...', 0);
            }            

            $scope.tasks = null;
            $scope.reviewTasks = null;
            loadingTask = true;
            $scope.tableParams.filter()['search'] = $rootScope.taskFilter.searchStr ? $rootScope.taskFilter.searchStr : '';
            if ($rootScope.taskFilter.showPromoted) {
                $scope.showPromotedTasks = $rootScope.taskFilter.showPromoted;
            }

            scaService.getTasks($scope.showPromotedTasks ? false : true).then(function (response) {
                if (response && response.length > 0) {
                    var branches = [];
                    for (let i =0 ; i < response.length; i++) {
                        if (response[i].status !== 'New') {
                            branches.push(response[i].branchPath);
                        }
                    }
                    if (branches.length > 0) {
                        findAndSetLastModifiedDate(branches, response).then(function(results) {
                            $scope.tasks = results;
                            loadingTask = false;
                            if ($scope.tasks) {
                                if (!disableNotification) {
                                    notificationService.sendMessage('All tasks loaded', 5000);
                                }
                            }
                        });
                    } else {
                        $scope.tasks = response;
                        loadingTask = false;
                        if ($scope.tasks) {
                            if (!disableNotification) {
                                notificationService.sendMessage('All tasks loaded', 5000);
                            }
                        }
                    }
                } else {
                   $scope.tasks = response;
                    loadingTask = false;
                    if ($scope.tasks) {
                        if (!disableNotification) {
                            notificationService.sendMessage('All tasks loaded', 5000);
                        }
                    }
                }
            });
        }

        function findAndSetLastModifiedDate (branches, tasks) {
            var deferred = $q.defer();
            terminologyServerService.getLastActivityOnBranches(branches).then(function(activities) {
                if(activities && activities.length > 0) {
                    var map = {};
                    for (let i =0 ; i < activities.length; i++) {
                        map[activities[i].branch.branchPath] = activities[i].commitDate;
                    }
                    var results = tasks;
                    for (let i =0 ; i < results.length; i++) {
                        var item = results[i];
                        if (item.branchHeadTimestamp) {
                            item.updated = new Date(item.updated).getTime() < item.branchHeadTimestamp ?
                                            $filter('date')(new Date(item.branchHeadTimestamp), 'yyyy-MM-ddTHH:mm:ss.sssZ', 'UTC') : item.updated;
                        }
                        if (map.hasOwnProperty(item.branchPath)) {
                            item.updated = new Date(item.updated).getTime() < new Date(map[item.branchPath]).getTime() ?
                                            $filter('date')(new Date(map[item.branchPath]), 'yyyy-MM-ddTHH:mm:ss.sssZ', 'UTC') : item.updated;
                        }
                    }
                    deferred.resolve(results);
                } else {
                    var results = tasks;
                    for (let i =0 ; i < results.length; i++) {
                        var item = results[i];
                        if (item.branchHeadTimestamp) {
                            item.updated = new Date(item.updated).getTime() < item.branchHeadTimestamp ?
                                            $filter('date')(new Date(item.branchHeadTimestamp), 'yyyy-MM-ddTHH:mm:ss.sssZ', 'UTC') : item.updated;
                        }
                    }
                    deferred.resolve(results);
                }
            }, function (error) {
                deferred.resolve(tasks);
            });

            return deferred.promise;
        }

        $scope.goToTask = function (task) {

            if (!task || !task.branchPath) {
                notificationService.sendError('Unexpected error, cannot access task');
            }
            $location.url('tasks/task/' + task.projectKey + '/' + task.key + '/edit');
        };

        $scope.goToConflicts = function (task) {

            if (!task || !task.branchPath) {
                notificationService.sendError('Unexpected error, cannot access task');
            }
            var projectBranch = task.branchPath.substring(0, task.branchPath.lastIndexOf('/'));

            // check for project lock before continuing
            terminologyServerService.getBranch(projectBranch).then(function (response) {
                if (!response.locked) {
                    scaService.getUiStateForTask(task.projectKey, task.key, 'edit-panel')
                        .then(function (uiState) {
                            if (!uiState || Object.getOwnPropertyNames(uiState).length === 0) {
                              redirectToConflicts(task.branchPath,task.projectKey,task.key);
                            }
                            else {
                              var promises = [];
                              for (var i = 0; i < uiState.length; i++) {
                                promises.push(scaService.getModifiedConceptForTask(task.projectKey, task.key, uiState[i]));
                              }
                              // on resolution of all promises
                              $q.all(promises).then(function (responses) {
                                var hasUnsavedConcept = responses.filter(function(concept){return concept !== null}).length > 0;
                                if (hasUnsavedConcept) {
                                  modalService.message('There are some unsaved concepts. Please go to task editing and save them before rebasing.');
                                } else {
                                  redirectToConflicts(task.branchPath,task.projectKey,task.key);
                                }
                              });
                            }
                          }
                        );
                }
                else {
                    notificationService.sendWarning('Unable to open conflicts view for ' + task.key + ' as the project branch is locked due to ongoing changes.', 7000);
                }
            });
        };

        function redirectToConflicts(branchRoot, projectKey, taskKey) {
          // check for branch lock before continuing
          terminologyServerService.getBranch(branchRoot + '/' + projectKey).then(function (response) {
            if (!response.locked) {
              $location.url('tasks/task/' + projectKey + '/' + taskKey + '/conflicts');
            }
            else {
              notificationService.sendWarning('Unable to open conflicts view on task ' + taskKey + ' as the project branch is locked due to ongoing changes.', 7000);
            }
          });
        }
    
        $scope.refreshTable = function () {
            $scope.preferences.selectedType = $scope.selectedType.type;
            accountService.saveUserPreferences($scope.preferences).then(function (response) {
            });
            $scope.tableParams.reload();
        }

        $scope.$watch('rebaseComplete', function () {
            $scope.tableParams.reload();
        }, true);
    
        $scope.matchTasksToProjects = function() {
            angular.forEach($scope.tasks, function (task) {
                angular.forEach($scope.projects, function (project) {
                    if(task.projectKey === project.key && project.codeSystem){
                        task.codeSystem = project.codeSystem;
                    }
                });
            });
        }

        // on successful set, reload table parameters
        $scope.$watch('tasks', function () {
            if($scope.projects && $scope.projects.length > 0){
                $scope.matchTasksToProjects();
            }
            $scope.tableParams.reload();
        }, true);
    
        $scope.$watch('projects', function () {
            var anyInternationalProjectPresent = false;
            angular.forEach($scope.projects, function(project) {
              project.lead = project.projectLead.displayName;
              if (!project.codeSystem.maintainerType) {
                anyInternationalProjectPresent = true;
              }
              if(project.codeSystem && project.codeSystem.maintainerType && project.codeSystem.maintainerType !== undefined  && !$scope.typeDropdown.includes(project.codeSystem.maintainerType)){
                 $scope.typeDropdown.push(project.codeSystem.maintainerType);
              }
              
            });
            if (anyInternationalProjectPresent && !$scope.typeDropdown.includes('International')) {
                $scope.typeDropdown.splice(1, 0, 'International');
            }
            $scope.tableParams.reload();
        }, true);

        $scope.openCreateTaskModal = function () {
            var modalInstance = $modal.open({
                templateUrl: 'shared/task/task.html',
                controller: 'taskCtrl',
                resolve: {
                    task: function () {
                        return null;
                    },
                    canDelete: function () {
                        return false;
                    }
                }
            });

            modalInstance.result.then(function (response) {
                if (response) {
                    addingTaskToList(response);
                }
            }, function () {
            });
        };

        $scope.openSearchTasksModel = function () {
            $modal.open({
                templateUrl: 'shared/task/taskSearch.html',
                controller: 'taskSearchCtrl',
                resolve: {
                    task: function () {
                        return null;
                    },
                    canDelete: function () {
                        return false;
                    }
                }
            });
        };

        function addingTaskToList (newTask) {
            if (newTask) {
                if (loadingTask) {
                    var loadingTasksPoll = $interval(function () {
                        if (!loadingTask) {
                            if ($scope.tasks.filter(function (task) {
                                return newTask.key === task.key;
                              }).length === 0) {
                                $scope.tasks.push(newTask);
                            }
                            $interval.cancel(loadingTasksPoll);
                        }
                    }, 100);
                } else {
                    $scope.tasks.push(newTask);
                }
            }            
        }

        $scope.isProjectsLoaded = function() {            
            return $scope.projects && $scope.projects.length > 0;
        };

        $scope.$on('reloadTasks', function (event, data) {
            if (data && data.isCreateTask) {
                addingTaskToList(data.concept);
            } else if (data && data.disableNotification) {
                loadTasks(true);
            } else {
                loadTasks();
            }
        });

// Initialization:  get tasks and classifications
        function initialize() {
            $scope.tasks = [];
            $scope.projects = metadataService.getProjects();
            angular.forEach($scope.projects, function(project) {
                if(project.codeSystem && project.codeSystem.maintainerType && project.codeSystem.maintainerType !== undefined  && !$scope.typeDropdown.includes(project.codeSystem.maintainerType)){
                    $scope.typeDropdown.push(project.codeSystem.maintainerType);
                }
            });
            accountService.getUserPreferences().then(function (preferences) {
                $scope.preferences = preferences;

                if(preferences.hasOwnProperty("selectedType")) {
                    $scope.selectedType.type = $scope.preferences.selectedType;
                }
            });
            loadTasks();              
        }

        initialize();
    })
;
