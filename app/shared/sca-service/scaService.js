'use strict';

angular.module('singleConceptAuthoringApp')
  .service('scaService', ['$http', '$rootScope', '$location', '$q', '$interval', 'notificationService', function ($http, $rootScope, $location, $q, $interval, notificationService) {

    // TODO Wire this to endpoint service, endpoint config
    var apiEndpoint = '../snowowl/ihtsdo-sca/';

    return {

      /////////////////////////////////////
      // authoring-projects calls
      /////////////////////////////////////

      // get all projects
      getProjects: function () {
        return $http.get(apiEndpoint + 'projects').then(
          function (response) {
            return response.data;
          }, function (error) {
            // TODO Handle errors
          }
        );
      },

      // get tasks for current user across all projects
      getTasks: function () {
        return $http.get(apiEndpoint + 'projects/my-tasks').then(
          function (response) {
            if ($rootScope.loggedIn === null) {
              $rootScope.loggedIn = true;

              // temporary check to verify authentication on Home component
              // will later be replaced by accountService call in app.js
//              if (response.data.length > 0) {
//                $rootScope.accountDetails = response.data[0].assignee;
//              }
            }

            return response.data;
          }, function (error) {
            if (error.status === 403) {
              $location.path('/login');
            }
          }
        );
      },

      getReviewTasks: function () {
        return $http.get(apiEndpoint + 'projects/review-tasks').then(
          function (response) {
            if ($rootScope.loggedIn === null) {
              $rootScope.loggedIn = true;
            }

            return response.data;
          }, function (error) {
            if (error.status === 403) {
              $location.path('/login');
            }
          }
        );
      },

      // get current user's tasks for a project
      getTasksForProject: function (projectKey) {
        if (!projectKey) {
          console.error('Must specify projectKey to get tasks for project');
          return {};
        }
        return $http.get(apiEndpoint + 'projects/' + projectKey + '/tasks').then(
          function (response) {
            return response.data;
          }, function (error) {
            // TODO Handle errors
          }
        );
      },

      // create a task for a project, assigned to current user
      createTaskForProject: function (projectKey, task) {

        var deferred = $q.defer();

        if (!projectKey) {
          deferred.reject('Must specify projectKey to create a task');
        }
        if (!task) {
          deferred.reject('Must specify task parameters to create a task');
        }
        $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks', task).then(
          function (response) {
            deferred.resolve(response);
          }, function (error, data) {
            deferred.reject(error);
          }
        );

        return deferred.promise;
      },

      // get a specific task for a project
      getTaskForProject: function (projectKey, taskKey) {
        if (!projectKey) {
          console.error('Must specify projectKey to get a task for project');
          return {};
        }
        if (!taskKey) {
          console.error('Must specify taskKey to get a task for project');
        }
        return $http.get(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey).then(
          function (response) {

            // temporary check to verify authentication on Edit component
            // will later be replaced by accountService call in app.js
//            $rootScope.accountDetails = response.data.assignee;

            return response.data;
          }, function (error) {
            if (error.status === 403) {
              $location.path('/login');
            }
          }
        );
      },

      /////////////////////////////////////
      // ui-state calls
      /////////////////////////////////////

      // get the UI state for a project, task, and panel triplet
      getUiStateForUser: function (panelId) {
        if (!panelId) {
          console.error('Must specify panelId to get UI state');
          return {};
        }
        return $http.get(apiEndpoint + 'ui-state/' + panelId).then(
          function (response) {
            return response.data;
          }, function (error) {
            return {};
          }
        );
      },

      // save the UI state for a project, task, and panel triplet
      saveUiStateForUser: function (panelId, uiState) {
        if (!panelId) {
          console.error('Must specify panelId to save UI state');
          return {};
        }
        if (!uiState) {
          console.error('Must supply ui state in order to save it');
          return {};
        }
        return $http.post(apiEndpoint + 'ui-state/' + panelId, uiState).then(
          function (response) {
            return response;
          }, function (error) {
            return null;
          }
        );
      },

      // get the UI state for a project, task, and panel triplet
      getUiStateForTask: function (projectKey, taskKey, panelId) {
        if (!projectKey) {
          console.error('Must specify projectKey to get UI state');
          return {};
        }
        if (!taskKey) {
          console.error('Must specify taskKey to get UI state');
          return {};
        }
        if (!panelId) {
          console.error('Must specify panelId to get UI state');
          return {};
        }
        return $http.get(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/ui-state/' + panelId).then(
          function (response) {
            return response.data;
          }, function (error) {
            return {};
          }
        );
      },

      // save the UI state for a project, task, and panel triplet
      saveUiStateForTask: function (projectKey, taskKey, panelId, uiState) {
        if (!projectKey) {
          console.error('Must specify projectKey to save UI state');
          return {};
        }
        if (!taskKey) {
          console.error('Must specify taskKey to save UI state');
          return {};
        }
        if (!panelId) {
          console.error('Must specify panelId to save UI state');
          return {};
        }
        if (!uiState) {
          console.error('Must supply ui state in order to save it');
          return {};
        }
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/ui-state/' + panelId, uiState).then(
          function (response) {
            return response;
          }, function (error) {
            return null;
          }
        );
      },

      ////////////////////////////////////////////////
      // ui-state calls (specific use wrappers)
      ////////////////////////////////////////////////

      getModifiedConceptForTask: function (projectKey, taskKey, conceptId) {
        if (!projectKey) {
          console.error('Must specify projectKey to get UI state');
          return {};
        }
        if (!taskKey) {
          console.error('Must specify taskKey to get UI state');
          return {};
        }

        console.debug('getModifiedConceptForTask', projectKey, taskKey, conceptId);

        return $http.get(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/ui-state/concept-' + conceptId).then(
          function (response) {
            return response.data;
          }, function (error) {
            // NOTE: if doesn't exist, 404s, return null
            return null;
          }
        );
      },

      saveModifiedConceptForTask: function (projectKey, taskKey, concept) {
        if (!projectKey) {
          console.error('Must specify projectKey to save concept in UI state');
          return {};
        }
        if (!taskKey) {
          console.error('Must specify taskKey to save concept in UI state');
          return {};
        }
        if (!concept) {
          console.error('Must specify concept to save concept in UI state. Use {} for empty concept');
        }

        console.debug('autosaving modified concept', projectKey, taskKey, concept);

        // TODO Refine this when support for multiple unsaved concepts goes in
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/ui-state/concept-' + ( concept.conceptId ? concept.conceptId : 'unsaved' ), concept).then(
          function (response) {
            return response.data;
          }, function (error) {
            return null;
          }
        );
      },

      ///////////////////////////////////////////////
      // Classification
      ///////////////////////////////////////////////

      // NOTE:  Task and project classification retrieval is done through
      // snowowlService

      // Initiate classification for a task
      // POST /projects/{projectKey}/tasks/{taskKey}/classification
      startClassificationForTask: function (projectKey, taskKey) {
        if (!projectKey) {
          console.error('Must specify projectKey to initiate classification');
          return {};
        }
        if (!taskKey) {
          console.error('Must specify taskKey to initiate classification');
          return {};
        }

        // POST call takes no data
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/classifications', {}).then(
          function (response) {
            return response;
          }, function (error) {
            console.error('Error starting classification for ' + projectKey + ', ' + taskKey);
            return null;
          });
      },

      // Start classification for a project
      // GET /projects/{projectKey}/classification
      startClassificationForProject: function (projectKey) {
        if (!projectKey) {
          console.error('Must specify projectKey to start classification');
          return {};
        }

        // POST call takes no data
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/classifications', {}).then(function (response) {
          return response.data;
        }, function (error) {
          console.error('Error getting classification for project ' + projectKey);
          return null;
        });

      },

      ///////////////////////////////////////////////
      // Validation
      ///////////////////////////////////////////////

      // Get latest validation for a task
      // GET /projects/{projectKey}/tasks/{taskKey}/validation
      getValidationForTask: function (projectKey, taskKey) {
        if (!projectKey) {
          console.error('Must specify projectKey to get latest validation results');
          return {};
        }
        if (!taskKey) {
          console.error('Must specify taskKey to get latest validation results');
          return {};
        }
        return $http.get(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/validation', {}).then(
          function (response) {
            return response.data;
          }, function (error) {
            console.error('Error getting latest validation for ' + projectKey + ', ' + taskKey);
            return null;
          });
      },

      // Initiate validation for a task
      // POST /projects/{projectKey}/tasks/{taskKey}/validation
      startValidationForTask: function (projectKey, taskKey) {
        if (!projectKey) {
          console.error('Must specify projectKey to initiate validation');
          return {};
        }
        if (!taskKey) {
          console.error('Must specify taskKey to initiate validation');
          return {};
        }

        // POST call takes no data
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/validation', {}).then(
          function (response) {
            return response;
          }, function (error) {
            console.error('Error starting validation for ' + projectKey + ', ' + taskKey);
            return null;
          });
      },

      // Initiate validation for a project
      // GET /projects/{projectKey}/validation
      getValidationForProject: function (projectKey) {
        if (!projectKey) {
          console.error('Must specify projectKey to get latest validation results');
          return {};
        }

        return $http.get(apiEndpoint + 'projects/' + projectKey + '/validation').then(function (response) {
          return response.data;
        }, function (error) {
          console.error('Error getting validation for project ' + projectKey);
          return null;
        });

      },

      // Get latest validation for a task
      // GET /projects/{projectKey}/tasks/{taskKey}/validation
      startValidationForProject: function (projectKey) {
        if (!projectKey) {
          console.error('Must specify projectKey to start validation');
          return {};
        }

        // POST call takes no data
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/validation', {}).then(function (response) {
          return response.data;
        }, function (error) {
          console.error('Error getting validation for project ' + projectKey);
          return null;
        });

      },

      //////////////////////////////////////////
      // Update Status
      //////////////////////////////////////////

      updateTask: function (projectKey, taskKey, object) {
        return $http.put(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey, object).then(function (response) {
          notificationService.sendMessage('Task ' + taskKey + ' marked ' + response.data.status, 5000, null, null);
          return response;
        }, function (error) {
          console.error('Error changing task status to ' + object.status + ' for ' + taskKey + ' in project ' + projectKey);
          notificationService.sendError('Error changing task status to ' + object.status + ' for ' + taskKey + ' in project ' + projectKey);
          return false;
        });
      },

      //////////////////////////////////////////
      // Review & Feedback
      //////////////////////////////////////////

      // mark as ready for review -- no return value
      markTaskForReview: function (projectKey, taskKey) {
        $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/review').then(function (response) {
          notificationService.sendMessage('Task ' + taskKey + ' marked for review');
        }, function (error) {
          console.error('Error marking task ready for review: ' + taskKey + ' in project ' + projectKey);
          notificationService.sendError('Error marking task ready for review: ' + taskKey + ' in project ' + projectKey, 10000);
        });
      },

      // get latest review
      getReviewForTask: function (projectKey, taskKey) {
        return $http.get(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/review').then(function (response) {
          return response.data;
        }, function (error) {

          // 404 errors indicate no review is available
          if (error.status !== 404) {
            console.error('Error retrieving review for task ' + taskKey + ' in project ' + projectKey, error);
            notificationService.sendError('Error retrieving review for task ' + taskKey + ' in project ' + projectKey, 10000);
          }
          return null;
        });
      },

      // add feedback to a review
      addFeedbackToTaskReview: function (projectKey, taskKey, messageHtml, subjectConceptIds, requestFollowup) {

        var feedbackContainer = {
          subjectConceptIds: subjectConceptIds,
          messageHtml: messageHtml,
          feedbackRequested: requestFollowup
        };

        return $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/review/message', feedbackContainer).then(function (response) {
          return response.data;

        }, function (error) {
          console.error('Error submitting feedback for task ' + taskKey + ' in project ' + projectKey, feedbackContainer, error);
          notificationService.sendError('Error submitting feedback', 10000);
        });
      },

      //POST
      // /projects/{projectKey}/tasks/{taskKey}/review/concepts/{conceptId}/read
      markTaskFeedbackRead: function (projectKey, taskKey, conceptId) {

        return $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/review/concepts/' + conceptId + '/read', {}).then(function (response) {
          return response;
        }, function (error) {
          console.error('Error marking feedback read ' + taskKey + ' in project ' + projectKey + ' for concept ' + conceptId);
          notificationService.sendError('Error marking feedback read', 10000);
          return null;
        });
      },

      // mark as ready for review -- no return value
      markProjectForReview: function (projectKey) {
        $http.post(apiEndpoint + 'projects/' + projectKey + '/review').then(function (response) {
          notificationService.sendMessage('Project ' + projectKey + ' marked for review');
        }, function (error) {
          console.error('Error marking project ready for review ' + projectKey);
          notificationService.sendError('Error marking project ready for review: ' + projectKey, 10000);
        });
      },

      // get latest review
      getReviewForProject: function (projectKey) {
        return $http.get(apiEndpoint + 'projects/' + projectKey + '/review').then(function (response) {
          return response.data;
        }, function (error) {

          // 404 errors indicate no review is available
          if (error.status !== 404) {
            console.error('Error retrieving review for project ' + projectKey, error);
            notificationService.sendError('Error retrieving review for project ' + projectKey, 10000);
          }
          return null;
        });
      },

      // add feedback to a review
      addFeedbackToProjectReview: function (projectKey, messageHtml, subjectConceptIds, requestFollowup) {

        var feedbackContainer = {
          subjectConceptIds: subjectConceptIds,
          messageHtml: messageHtml,
          feedbackRequested: requestFollowup
        };

        return $http.post(apiEndpoint + 'projects/' + projectKey + '/review/message', feedbackContainer).then(function (response) {
          return response.data;

        }, function (error) {
          console.error('Error submitting feedback for project ' + projectKey, feedbackContainer, error);
          notificationService.sendError('Error submitting feedback', 10000);
        });
      },

      //POST
      // /projects/{projectKey}/tasks/{taskKey}/review/concepts/{conceptId}/read
      markProjectFeedbackRead: function (projectKey, conceptId) {

        return $http.post(apiEndpoint + 'projects/' + projectKey + '/review/concepts/' + conceptId + '/read', {}).then(function (response) {
          return response;
        }, function (error) {
          console.error('Error marking feedback read in project ' + projectKey + ' for concept ' + conceptId);
          notificationService.sendError('Error marking feedback read', 10000);
          return null;
        });
      },

      //////////////////////////////////////////
      // Conflicts, Rebase, and Promotion
      //////////////////////////////////////////

      // POST /projects/{projectKey}/promote 
      // Promote the project to MAIN
      promoteProject: function (projectKey) {
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/promote', {}).then(function (response) {
          notificationService.sendMessage('Project Promoted Successfully', 10000);
          return response.data;
        }, function (error) {
          console.error('Error promoting project ' + projectKey);
          notificationService.sendError('Error promoting project', 10000);
          return null;
        });
      },

      // GET /projects/{projectKey}/rebase 
      // Generate the conflicts report between the Project and MAIN
      getConflictReportForProject: function (projectKey) {
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/rebase-conflicts', {}).then(function (response) {
          return response.data;
        }, function (error) {
          console.error('Error getting conflict report for project ' + projectKey);
          notificationService.sendError('Error getting conflict report for project', 10000);
          return null;
        });
      },

      // POST /projects/{projectKey}/rebase 
      // Rebase the project from MAIN
      rebaseProject: function (projectKey) {
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/rebase', {}).then(function (response) {
          notificationService.sendMessage('Project Rebased Successfully', 10000);
          return response.data;
        }, function (error) {
          console.error('Error rebasing project ' + projectKey);
          notificationService.sendError('Error rebasing project', 10000);
          return null;
        });
      },
      // POST /projects/{projectKey}/tasks/{taskKey}/promote 
      // Promote the task to the Project
      promoteTask: function (projectKey, taskKey) {
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/promote', {}).then(function (response) {
          notificationService.sendMessage('Task Promoted Successfully', 10000);
          return response.data;
        }, function (error) {
          notificationService.sendError('Error promoting task', 10000);
          return null;
        });
      },
      // GET /projects/{projectKey}/tasks/{taskKey}/rebase 
      // Generate the conflicts report between the Task and the Project
      getConflictReportForTask: function (projectKey, taskKey) {
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/rebase-conflicts', {}).then(function (response) {
          return response.data;
        }, function (error) {
          console.error('Error retrieving conflict report for project ' + projectKey + ', task ' + taskKey);
          notificationService.sendError('Error retrieving conflict report', 10000);
          return null;
        });
      },

      // POST /projects/{projectKey}/tasks/{taskKey}/rebase 
      // Rebase the task from the project
      rebaseTask: function (projectKey, taskKey) {
        return $http.post(apiEndpoint + 'projects/' + projectKey + '/tasks/' + taskKey + '/rebase', {}).then(function (response) {
          return response.data;
        }, function (error) {
          console.error('Error rebasing project ' + projectKey + ', task ' + taskKey);
          notificationService.sendError('Error rebasing task', 10000);
          return null;
        });
      },

      //////////////////////////////////////////
      // Notification Polling
      //////////////////////////////////////////

      monitorTask: function (projectKey, taskKey) {
        return $http.post(apiEndpoint + 'monitor', {
          'projectId': projectKey,
          'taskId': taskKey
        }).then(function (response) {
          return response.data;
        }, function (error) {
          console.error('Error monitoring project/task ' + projectKey + '/' + taskKey);
          notificationService.sendError('Error monitoring project ' + projectKey + ', task ' + taskKey);
          return null;
        });
      },

      monitorProject: function (projectKey) {
        return $http.post(apiEndpoint + 'monitor', {'projectId': projectKey}).then(function (response) {
          return response.data;
        }, function (error) {
          console.error('Error monitoring project' + projectKey);
          notificationService.sendError('Error monitoring project ' + projectKey);
          return null;
        });
      },

      // directly retrieve notification
      // TODO Decide if we want to instantiate this, will duplicate
      // notification handling which should be moved to a non-exposed function
      getNotifications: function () {
        return null;
      },

      // start polling
      startPolling: function (intervalInMs) {

        console.log('Starting application notification polling with interval ' + intervalInMs + 'ms');

        // instantiate poll (every 10s)
        var scaPoll = $interval(function () {

          $http.get(apiEndpoint + 'notifications').then(function (response) {
            if (response && response.data && response.data[0]) {

              console.debug('NEW NOTIFICATION', response);

              // getNotifications returns an array, get the latest
              // TODO Fold all results into a drop-down list in top right corner
              var newNotification = response.data[0];

              var msg = null;
              var url = null;

              /**
               * Current supported notification entity types:
               *  Validation, Feedback, Classification, Rebase, Promotion,
               * ConflictReport, BranchState
               */

              if (newNotification.entityType) {

                // construct message and url based on entity type
                switch (newNotification.entityType) {

                  case 'Rebase':
                    // TODO Handle rebase notifications
                    break;

                  case 'ConflictReport':
                    // TODO Handle conflict report notifications
                    break;

                  case 'Promotion':
                    // TODO Handle promotion notifications
                    break;

                  /*
                   Feedback completion object structure
                   {
                   project: "WRPAS",
                   task: "WRPAS-76",
                   entityType: "Feedback",
                   event: "new"}
                   */

                  case 'Feedback':
                    if (newNotification.event) {
                      // convert to first-character capitalized for all words
                      newNotification.event = newNotification.event.toLowerCase().replace(/\w\S*/g, function (txt) {
                        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                      });
                    }
                    msg = newNotification.event + ' feedback for project ' + newNotification.project + ' and task ' + newNotification.task;
                    url = '#/tasks/task/' + newNotification.project + '/' + newNotification.task + '/feedback';
                    break;

                  /*
                   Classification completion object structure
                   entityType: "Classification"
                   event: "Classification completed successfully"
                   project: "WRPAS"
                   task: "WRPAS-98" (omitted for project)
                   */
                  case 'Classification':
                    msg = newNotification.event + ' for project ' + newNotification.project + (newNotification.task ? ' and task ' + newNotification.task : '');
                    if (newNotification.task) {
                      url = '#/tasks/task/' + newNotification.project + '/' + newNotification.task + '/classify';
                    } else {
                      url = '#/projects/project/' + newNotification.project + '/classify';
                    }
                    break;

                  /*
                   Branch status change completion object structure
                   entityType: "BranchState"
                   event: "New Status" (listening for DIVERGED to handle the list refresh on the concepts page)
                   */
                  case 'BranchState':
                    if (newNotification.event === 'DIVERGED') {
                      $rootScope.$broadcast('branchDiverged');
                      $rootScope.$broadcast('notification.branchState', newNotification);
                    }
                    break;

                  /*
                   Validation completion object structure
                   entityType: "Validation"
                   event: "COMPLETED"
                   project: "WRPAS"
                   task: "WRPAS-98" (omitted for project)
                   */
                  case 'Validation':

                    // convert to first-character capitalized for all words
                    var event = newNotification.event.toLowerCase().replace(/\w\S*/g, function (txt) {
                      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                    });
                    msg = 'Validation ' + event + ' for project ' + newNotification.project + (newNotification.task ? ' and task ' + newNotification.task : '');
                    if (newNotification.task) {
                      url = '#/tasks/task/' + newNotification.project + '/' + newNotification.task + '/validate';
                    } else {
                      url = '#/projects/project/' + newNotification.project + '/validate';
                    }
                    break;
                  default:
                    console.error('Unknown entity type for notification, stopping', +newNotification);
                    return;
                }

                // send the notification (if message supplied) with optional url
                if (msg) {
                  notificationService.sendMessage(msg, 0, url);
                }
              } else {
                console.error('Unknown notification type received', newNotification);
                notificationService.sendError('Unknown notification received', 10000, null);
              }

            }
          });
        }, intervalInMs);
      }

    };

  }])
;
